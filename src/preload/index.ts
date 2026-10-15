/**
 * Preload bridge.
 *
 * `sandbox: true` + `contextIsolation: true`: the renderer only ever sees the
 * frozen object exposed here, and every response envelope from the main
 * process is unwrapped into a normal promise rejection.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type AppState, type LogEntry, type Toast } from '../shared/bridge'
import type { NaxloApi } from '../shared/api'

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string }

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Envelope<T>
  if (result && result.ok === false) throw new Error(result.error)
  return (result as { data: T }).data
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const api: NaxloApi = {
  getState: () => invoke<AppState>(IPC.stateGet),
  onState: (listener) => subscribe<AppState>(IPC.stateChanged, listener),

  servers: {
    list: () => invoke(IPC.serversList),
    select: (id) => invoke(IPC.serversSelect, id),
    reveal: (id) => invoke(IPC.serversReveal, id),
    remove: (id) => invoke(IPC.serversRemove, id),
    clear: () => invoke(IPC.serversClear),
    test: (id) => invoke(IPC.serversTest, id),
    testAll: () => invoke(IPC.serversTestAll),
    latency: () => invoke(IPC.serversLatency),
    copyLink: (id) => invoke(IPC.clipboardWrite, { kind: 'link', serverId: id })
  },

  subscription: {
    save: (url) => invoke(IPC.subscriptionSave, url),
    reveal: () => invoke<string | null>(IPC.subscriptionReveal),
    refresh: () => invoke(IPC.subscriptionRefresh),
    clear: () => invoke(IPC.subscriptionClear),
    importFile: () => invoke(IPC.subscriptionImportFile)
  },

  connection: {
    connect: (serverId) => invoke(IPC.connect, serverId),
    disconnect: () => invoke(IPC.disconnect)
  },

  settings: {
    get: () => invoke(IPC.settingsGet),
    set: (patch) => invoke(IPC.settingsSet, patch)
  },

  core: {
    ensure: () => invoke(IPC.coreEnsure),
    pick: () => invoke(IPC.corePick),
    checkUpdate: () => invoke(IPC.coreCheckUpdate)
  },

  logs: {
    get: () => invoke<LogEntry[]>(IPC.logsGet),
    clear: () => invoke(IPC.logsClear),
    onChange: (listener) => subscribe<LogEntry>(IPC.logsChanged, listener)
  },

  toasts: {
    on: (listener) => subscribe<Toast>(IPC.toast, listener)
  },

  window: {
    minimize: () => invoke(IPC.windowMinimize),
    toggleMaximize: () => invoke(IPC.windowMaximize),
    close: () => invoke(IPC.windowClose)
  },

  shell: {
    open: (url) => invoke(IPC.shellOpen, url)
  },

  app: {
    info: () => invoke(IPC.appInfo),
    checkUpdate: () => invoke(IPC.appUpdate)
  }
}

contextBridge.exposeInMainWorld('naxlo', api)
