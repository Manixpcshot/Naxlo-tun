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
  type SubscriptionView,
  type Toast
} from '../shared/bridge'
import { log } from './lib/logger'
import { getVault } from './lib/secretStore'
import type { LString } from '../shared/i18n'

const SCOPE = 'state'

let state: AppState = {
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

/** Per-subscription "fetching" flags live outside the vault (transient). */
const subscriptionFetching = new Map<string, boolean>()

export function setSubscriptionFetching(id: string, fetching: boolean): AppState {
  subscriptionFetching.set(id, fetching)
  return syncSubscriptions()
}

/** Rebuild the (masked) subscription views from the vault and broadcast. */
export function syncSubscriptions(): AppState {
  const vault = getVault()
  const views: SubscriptionView[] = vault.subscriptions.map((sub) => {
    const servers = vault.servers.filter((server) => server.subscriptionId === sub.id)
    return {
      id: sub.id,
      name: sub.name,
      maskedUrl: maskUrl(sub.url),
      updatedAt: sub.updatedAt,
      userinfo: sub.userinfo,
      lastError: sub.lastError,
      fetching: subscriptionFetching.get(sub.id) ?? false,
      totalConfigs: servers.length,
      supportedConfigs: servers.filter((server) => server.supported).length
    }
  })
  state = { ...state, subscriptions: views }
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
export function toServerView(server: ServerConfig, reveal = false, pinned = false): ServerView {
  const { credential: _c, pbk: _p, sid: _s, raw: _r, address: _a, ...safe } = server
  const view: ServerView = {
    pinned,
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

