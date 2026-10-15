/**
 * The renderer-facing API contract.
 *
 * Implemented in `src/preload/index.ts`, consumed in the renderer through
 * `window.naxlo`. Only masked data crosses this boundary; `servers.reveal()`
 * is the single explicit escape hatch and is used by the "show secret" toggle.
 */
import type {
  AppState,
  CoreStatus,
  LogEntry,
  ServerView,
  Settings,
  Toast
} from './types'

export interface FetchReportView {
  ok: boolean
  total: number
  supported: number
  merged: number
  error: string | null
  warnings: string[]
}

export interface AppInfo {
  version: string
  platform: string
  arch: string
  electron: string
  node: string
  chrome: string
  /** How the vault is protected on this machine. */
  protection: 'safeStorage' | 'aes-256-gcm' | 'none'
  userData: string
  logsDir: string
}

export interface CoreUpdateInfo {
  current: string | null
  latest: string | null
  updateAvailable: boolean
}

export interface AppUpdateInfo {
  current: string
  latest: string | null
  updateAvailable: boolean
  releaseUrl: string | null
}

export interface NaxloApi {
  getState(): Promise<AppState>
  onState(listener: (state: AppState) => void): () => void

  servers: {
    list(): Promise<ServerView[]>
    select(id: string): Promise<string>
    reveal(id: string): Promise<ServerView>
    remove(id: string): Promise<number>
    clear(): Promise<boolean>
    test(id: string): Promise<number | null>
    testAll(): Promise<number>
    latency(): Promise<Record<string, number | null>>
    copyLink(id: string): Promise<boolean>
  }

  subscription: {
    /** Add (or re-fetch, if already stored) a subscription and return the report. */
    save(url: string): Promise<FetchReportView>
    /** Explicit user action: returns the real URL so it can be edited. */
    reveal(id: string): Promise<string | null>
    /** Refresh one subscription (by id) or all of them. */
    refresh(id?: string): Promise<FetchReportView | FetchReportView[]>
    remove(id: string): Promise<boolean>
    clear(): Promise<boolean>
    importFile(): Promise<FetchReportView | { imported: number }>
  }

  speed: {
    /** Download-throughput measurement through the local proxy (Mbps). */
    test(): Promise<{ mbps: number; bytes: number; ms: number }>
  }

  connection: {
    connect(serverId?: string): Promise<AppState['connection']>
    disconnect(): Promise<AppState['connection']>
  }

  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }

  core: {
    ensure(): Promise<CoreStatus>
    pick(): Promise<CoreStatus>
    checkUpdate(): Promise<CoreUpdateInfo>
  }

  logs: {
    get(): Promise<LogEntry[]>
    clear(): Promise<boolean>
    onChange(listener: (entry: LogEntry) => void): () => void
  }

  toasts: {
    on(listener: (toast: Toast) => void): () => void
  }

  window: {
    minimize(): Promise<boolean>
    toggleMaximize(): Promise<boolean>
    close(): Promise<boolean>
  }

  shell: {
    open(url: string): Promise<boolean>
  }

  app: {
    info(): Promise<AppInfo>
    checkUpdate(): Promise<AppUpdateInfo>
    /** Quit and run the staged installer (relaunches the app). */
    installUpdate(): Promise<boolean>
  }
}
