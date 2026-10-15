/**
 * Central application state.
 *
 * One source of truth, broadcast to every renderer through the preload bridge.
 * The state object only ever contains *masked* representations of sensitive
 * values (see `toServerView`).
 */
import { BrowserWindow } from 'electron'
import {
  IPC,
  maskAddress,
  maskMiddle,
  maskUrl,
  type AppState,
  type ConnectionState,
  type ServerConfig,
  type ServerView,
  type Settings,
  type SubscriptionInfo,
  type Toast
} from '../shared/bridge'
import { log } from './lib/logger'
import type { LString } from '../shared/i18n'

const SCOPE = 'state'

let state: AppState = {
  connection: 'idle',
  serversRevision: 0,
  selectedServerId: null,
  activeServerId: null,
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
  subscription: {
    hasUrl: false,
    maskedUrl: '',
    lastUpdated: null,
    lastError: null,
    totalConfigs: 0,
    supportedConfigs: 0,
    autoRefreshMinutes: 0,
    fetching: false
  }
}

type Listener = (state: AppState) => void
const listeners = new Set<Listener>()

export function getState(): AppState {
  return state
}

export function patchState(patch: Partial<AppState>): AppState {
  state = { ...state, ...patch }
  broadcast()
  return state
}

export function patchUpdate(patch: Partial<AppState['update']>): AppState {
  state = { ...state, update: { ...state.update, ...patch } }
  broadcast()
  return state
}

export function patchCore(patch: Partial<AppState['core']>): AppState {
  state = { ...state, core: { ...state.core, ...patch } }
  broadcast()
  return state
}

export function patchSubscription(patch: Partial<SubscriptionInfo>): AppState {
  state = { ...state, subscription: { ...state.subscription, ...patch } }
  broadcast()
  return state
}

export function setConnection(connection: ConnectionState, lastError: string | LString | null = null): AppState {
  state = { ...state, connection, lastError: lastError ?? (connection === 'error' ? state.lastError : null) }
  broadcast()
  return state
}

/** Signal that the server list changed (the renderer refetches masked views). */
export function bumpServers(): void {
  state = { ...state, serversRevision: state.serversRevision + 1 }
  broadcast()
}

export function setState(next: AppState): void {
  state = next
  broadcast()
}

export function subscribeToState(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function broadcast(): void {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.webContents.send(IPC.stateChanged, state)
    }
  } catch (err) {
    log.warn(SCOPE, 'broadcast failed', err)
  }
  for (const listener of listeners) {
    try {
      listener(state)
    } catch {
      /* ignore */
    }
  }
}

export function toast(kind: Toast['kind'], title: Toast['title'], message?: Toast['message']): void {
  const payload: Toast = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, title, message }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send(IPC.toast, payload)
  }
}

/** Masked projection of a server config for the renderer. */
export function toServerView(server: ServerConfig, reveal = false): ServerView {
  const { credential: _c, pbk: _p, sid: _s, raw: _r, address: _a, ...safe } = server
  const view: ServerView = {
    ...safe,
    addressMasked: maskAddress(server.address),
    credentialMasked: maskMiddle(server.credential, 4, 4),
    pbkMasked: server.pbk ? maskMiddle(server.pbk, 6, 4) : undefined,
    sidMasked: server.sid ? maskMiddle(server.sid, 2, 2) : undefined
  }
  if (reveal) {
    view.address = server.address
    view.credential = server.credential
    view.pbk = server.pbk
    view.sid = server.sid
    view.raw = server.raw
  }
  return view
}

export function subscriptionView(url: string | null, settings: Settings, extra?: Partial<SubscriptionInfo>): SubscriptionInfo {
  return {
    hasUrl: Boolean(url),
    maskedUrl: maskUrl(url),
    lastUpdated: null,
    lastError: null,
    totalConfigs: 0,
    supportedConfigs: 0,
    autoRefreshMinutes: settings.autoRefreshMinutes,
    fetching: false,
    ...extra
  }
}
