/**
 * Tauri shim for the `window.naxlo` bridge.
 *
 * Implements the exact `NaxloApi` contract from `src/shared/api.ts` on top of
 * Tauri's `invoke`/`listen`, so the React app runs unchanged against the Rust
 * backend. Rust commands fail with a JSON-encoded `{ fa, en }` string; we
 * re-throw the parsed object so renderer code sees precisely what the
 * Electron preload bridge throws.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { AppInfo, AppUpdateInfo, CoreUpdateInfo, FetchReportView, NaxloApi } from '../../src/shared/api'
import type { AppState, CoreStatus, LogEntry, ServerView, Settings, Toast } from '../../src/shared/bridge'

type LString = { fa: string; en: string }

function normalizeError(raw: unknown): LString {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Partial<LString> | null
      if (parsed && typeof parsed === 'object' && typeof parsed.fa === 'string') {
        return { fa: parsed.fa, en: typeof parsed.en === 'string' ? parsed.en : parsed.fa }
      }
    } catch {
      /* not JSON — fall through */
    }
    return { fa: raw, en: raw }
  }
  if (raw && typeof raw === 'object' && 'fa' in raw) {
    const candidate = raw as Partial<LString>
    if (typeof candidate.fa === 'string') {
      return { fa: candidate.fa, en: typeof candidate.en === 'string' ? candidate.en : candidate.fa }
    }
  }
  const text = raw instanceof Error ? raw.message : String(raw)
  return { fa: text, en: text }
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (raw) {
    throw normalizeError(raw)
  }
}

/**
 * Electron's `subscribe` returns its unlisten function synchronously; Tauri's
 * `listen` is async. The cancelled-flag pattern keeps the contract identical.
 */
function subscribe<T>(event: string, listener: (payload: T) => void): () => void {
  let unlisten: UnlistenFn | null = null
  let cancelled = false
  void listen<T>(event, (e) => listener(e.payload)).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    unlisten?.()
  }
}

const api: NaxloApi = {
  getState: () => call<AppState>('get_state'),
  onState: (listener) => subscribe<AppState>('naxlo-state', listener),

  servers: {
    list: () => call<ServerView[]>('servers_list'),
    select: (id) => call<string>('servers_select', { id }),
    reveal: (id) => call<ServerView>('servers_reveal', { id }),
    remove: (id) => call<number>('servers_remove', { id }),
    clear: () => call<boolean>('servers_clear'),
    test: (id) => call<number | null>('servers_test', { id }),
    pin: (id) => call<string[]>('servers_pin', { id }),
    testAll: () => call<number>('servers_test_all'),
    latency: () => call<Record<string, number | null>>('servers_latency'),
    copyLink: (id) => call<boolean>('clipboard_write_link', { serverId: id })
  },

  subscription: {
    save: (url) => call<FetchReportView>('subscription_save', { url }),
    reveal: (id) => call<string | null>('subscription_reveal', { id }),
    // The Rust handler always answers with an array (same as the Electron ipc
    // handler); the renderer already handles both shapes.
    refresh: (id) => call<FetchReportView[]>('subscription_refresh', { id: id ?? null }),
    remove: (id) => call<boolean>('subscription_remove', { id }),
    clear: () => call<boolean>('subscription_clear'),
    importFile: (filePath?: string | null, password?: string | null) =>
      call<FetchReportView>('subscription_import_file', { filePath: filePath ?? null, password: password ?? null })
  },

  speed: {
    test: () => call<{ mbps: number; bytes: number; ms: number }>('speed_test')
  },

  connection: {
    connect: (serverId) => call<AppState['connection']>('connect', { serverId: serverId ?? null }),
    disconnect: () => call<AppState['connection']>('disconnect'),
    panic: () => call<boolean>('panic_disconnect')
  },

  settings: {
    get: () => call<Settings>('settings_get'),
    set: (patch) => call<Settings>('settings_set', { patch })
  },

  core: {
    ensure: () => call<CoreStatus>('core_ensure'),
    pick: () => call<CoreStatus>('core_pick'),
    checkUpdate: () => call<CoreUpdateInfo>('core_check_update')
  },

  logs: {
    get: () => call<LogEntry[]>('logs_get'),
    clear: () => call<boolean>('logs_clear'),
    onChange: (listener) => subscribe<LogEntry>('naxlo-log', listener)
  },

  toasts: {
    on: (listener) => subscribe<Toast>('naxlo-toast', listener)
  },

  window: {
    minimize: () => call<boolean>('window_minimize'),
    toggleMaximize: () => call<boolean>('window_toggle_maximize'),
    close: () => call<boolean>('window_close')
  },

  shell: {
    open: (url) => call<boolean>('shell_open', { url })
  },

  app: {
    info: () => call<AppInfo>('app_info'),
    checkUpdate: () => call<AppUpdateInfo>('app_check_update'),
    installUpdate: () => call<boolean>('app_install_update'),
    isAdmin: () => call<boolean>('app_is_admin'),
    relaunchElevated: () => call<boolean>('app_relaunch_elevated')
  }
}

window.__NAXLO_TAURI__ = true
window.naxlo = api
