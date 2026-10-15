/**
 * Renderer store.
 *
 * Wraps `window.naxlo`, keeps the app state / settings / server list in sync
 * and turns every main-process error into a toast so no failure is silent.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { AppState, LString, LogEntry, ServerView, Settings, Toast } from '@shared/bridge'
import { DEFAULT_SETTINGS, isLString } from '@shared/bridge'
import type { AppInfo } from '@shared/api'

const EMPTY_STATE: AppState = {
  connection: 'idle',
  serversRevision: 0,
  selectedServerId: null,
  activeServerId: null,
  activeSubscriptionId: null,
  activeServerName: null,
  activeServerAddressMasked: null,
  socksPort: 10808,
  httpPort: 10809,
  systemProxyEnabled: true,
  systemProxyApplied: false,
  startedAt: null,
  lastError: null,
  latencyMs: null,
  identity: null,
  update: {
    checking: false,
    downloading: false,
    progress: null,
    availableVersion: null,
    downloadedVersion: null,
    error: null,
    ready: false
  },
  core: {
    ready: false,
    path: null,
    version: null,
    source: null,
    downloading: false,
    progress: null,
    error: null
  },
  subscriptions: []
}

interface StoreShape {
  ready: boolean
  state: AppState
  settings: Settings
  servers: ServerView[]
  info: AppInfo | null
  logs: LogEntry[]
  toasts: Toast[]
  busy: boolean
  reloadServers: () => Promise<void>
  reloadSettings: () => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  pushToast: (toast: Omit<Toast, 'id'>) => void
  /** Human-readable form of a bridge rejection (bilingual payload or plain). */
  errorText: (error: unknown) => string | LString
  dismissToast: (id: string) => void
  clearLogs: () => Promise<void>
  /** Run a bridge call, surface failures as a toast, and return the value. */
  run: <T>(task: () => Promise<T>, errorTitle?: string | LString) => Promise<T | undefined>
}

const StoreContext = createContext<StoreShape | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [servers, setServers] = useState<ServerView[]>([])
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [busy, setBusy] = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }])
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      delete timers.current[id]
    }, toast.kind === 'error' ? 9000 : 5200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const reloadServers = useCallback(async () => {
    try {
      setServers(await window.naxlo.servers.list())
    } catch {
      /* surfaced elsewhere */
    }
  }, [])

  const reloadSettings = useCallback(async () => {
    try {
      setSettings(await window.naxlo.settings.get())
    } catch {
      /* ignore */
    }
  }, [])

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await window.naxlo.settings.set(patch))
  }, [])

  const errorText = useCallback((error: unknown): string | LString => {
    if (isLString(error)) return error
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return String(error)
  }, [])

  const run = useCallback(
    async <T,>(task: () => Promise<T>, errorTitle: string | LString = 'خطا'): Promise<T | undefined> => {
      setBusy(true)
      try {
        return await task()
      } catch (err) {
        pushToast({ kind: 'error', title: errorTitle, message: errorText(err) })
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [pushToast, errorText]
  )

  const clearLogs = useCallback(async () => {
    await window.naxlo.logs.clear()
    setLogs([])
  }, [])

  /* Initial load + subscriptions */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [initialState, initialSettings, initialServers, appInfo, initialLogs] = await Promise.all([
          window.naxlo.getState(),
          window.naxlo.settings.get(),
          window.naxlo.servers.list(),
          window.naxlo.app.info(),
          window.naxlo.logs.get()
        ])
        if (cancelled) return
        setState(initialState)
        setSettings(initialSettings)
        setServers(initialServers)
        setInfo(appInfo)
        setLogs(initialLogs.slice(-400))
        setReady(true)
      } catch {
        setReady(true)
      }
    })()

    const offState = window.naxlo.onState((next) => setState(next))
    const offToast = window.naxlo.toasts.on((toast) => {
      const id = toast.id
      setToasts((prev) => [...prev.slice(-3), toast])
      timers.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        delete timers.current[id]
      }, toast.kind === 'error' ? 9000 : 5200)
    })
    const offLog = window.naxlo.logs.onChange((entry) => {
      setLogs((prev) => (prev.length > 600 ? [...prev.slice(-500), entry] : [...prev, entry]))
    })

    return () => {
      cancelled = true
      offState()
      offToast()
      offLog()
      Object.values(timers.current).forEach(clearTimeout)
      timers.current = {}
    }
  }, [])

  /* Refetch the server list whenever the vault revision changes */
  const revision = state.serversRevision
  useEffect(() => {
    if (!ready) return
    void reloadServers()
  }, [revision, ready, reloadServers])

  /* Keep the accent + reduced-motion attributes in sync with the DOM */
  useEffect(() => {
    document.documentElement.dataset.accent = settings.accent
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion)
  }, [settings.accent, settings.reduceMotion])

  const value = useMemo<StoreShape>(
    () => ({
      ready,
      state,
      settings,
      servers,
      info,
      logs,
      toasts,
      busy,
      reloadServers,
      reloadSettings,
      saveSettings,
      pushToast,
      dismissToast,
      clearLogs,
      run,
      errorText
    }),
    [ready, state, settings, servers, info, logs, toasts, busy, reloadServers, reloadSettings, saveSettings, pushToast, dismissToast, clearLogs, run, errorText]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
