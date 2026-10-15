/**
 * IPC surface.
 *
 * Every handler returns an envelope so the renderer never has to guess whether
 * a rejection was a bug or an expected failure. Sensitive values are masked
 * before they cross the bridge; `serversReveal` is the single, explicit
 * exception and it is guarded by a user action.
 */
import { BrowserWindow, app, clipboard, dialog, ipcMain, shell } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { IPC, maskUrl, type LogEntry, type LString, type ServerView, type Settings } from '../shared/bridge'
import { AppError, L, toLString } from '../shared/i18n'
import { getState, patchState, patchSubscription, toServerView } from './state'
import { getSettings, loadSettings, updateSettings } from './lib/settings'
import { getVault, persistNow, updateVault, vaultEncryptionKind, wipeVault } from './lib/secretStore'
import { log, getLogs, clearLogs, onLog, setLogLevel } from './lib/logger'
import { redact, registerSecret, clearSecrets } from './lib/redact'
import { importPayload, refreshSubscription, SubscriptionError } from './lib/subscription'
import { manager } from './lib/xray/manager'
import { rebuildMenu } from './tray'
import { runtime } from './runtime'
import { isAllowedExternalUrl } from './window'
import { purgeDownloadedCores } from './lib/xray/core'
import { checkAppUpdate } from './lib/update'
import { installNow } from './lib/updater'

const SCOPE = 'ipc'

type Envelope<T> = { ok: true; data: T } | { ok: false; error: LString }

const ok = <T>(data: T): Envelope<T> => ({ ok: true, data })
const fail = (error: unknown): Envelope<never> => {
  const localized = toLString(error)
  return { ok: false, error: { fa: redact(localized.fa), en: redact(localized.en) } }
}

function handle<T>(channel: string, fn: (...args: any[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, ...args: any[]) => {
    try {
      return ok(await fn(...args))
    } catch (err) {
      log.error(SCOPE, `handler failed on ${channel}`, err)
      return fail(err)
    }
  })
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  /* ------------------------------------------------------------- state */
  handle(IPC.stateGet, () => getState())
  handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    protection: vaultEncryptionKind(),
    userData: app.getPath('userData'),
    logsDir: `${app.getPath('userData')}\\logs`
  }))

  handle(IPC.appUpdate, () => checkAppUpdate())
  handle(IPC.appInstallUpdate, () => {
    installNow()
    return true
  })

  /* ----------------------------------------------------------- servers */
  handle(IPC.serversList, () => listServers(false))
  handle(IPC.serversReveal, (id: string) => {
    const server = getVault().servers.find((s) => s.id === id)
    if (!server) throw new AppError(L('سرور پیدا نشد', 'Server not found'))
    log.info(SCOPE, 'user revealed sensitive fields for one server')
    return toServerView(server, true)
  })
  handle(IPC.serversSelect, (id: string) => {
    const server = getVault().servers.find((s) => s.id === id)
    if (!server) throw new AppError(L('سرور پیدا نشد', 'Server not found'))
    updateVault({ selectedServerId: id })
    patchState({ selectedServerId: id })
    return id
  })
  handle(IPC.serversRemove, (id: string) => {
    const servers = getVault().servers.filter((s) => s.id !== id)
    updateVault({ servers })
    syncSubscriptionCounts()
    return servers.length
  })
  handle(IPC.serversClear, () => {
    updateVault({ servers: [], selectedServerId: null })
    syncSubscriptionCounts()
    return true
  })
  handle(IPC.serversTest, async (id: string) => manager.testServer(id))
  handle(IPC.serversTestAll, async () => manager.testAll())
  handle(IPC.serversLatency, () =>
    getVault().servers.reduce<Record<string, number | null>>((acc, s) => {
      acc[s.id] = s.latencyMs
      return acc
    }, {})
  )

  /* ------------------------------------------------------ subscription */
  handle(IPC.subscriptionSave, async (url: string) => {
    const trimmed = (url ?? '').trim()
    if (!trimmed) throw new AppError(L('لینک اشتراک خالی است', 'Subscription URL is empty'))
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new AppError(
        L('لینک اشتراک معتبر نیست (باید با http:// یا https:// شروع شود)', 'Invalid subscription URL (must start with http:// or https://)')
      )
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new AppError(L('فقط لینک‌های http و https پشتیبانی می‌شوند', 'Only http and https links are supported'))
    }
    registerSecret(trimmed, 'subscription')
    patchSubscription({ fetching: true, lastError: null })
    try {
      const report = await refreshSubscription(trimmed)
      patchSubscription({
        fetching: false,
        lastError: null,
        lastUpdated: Date.now(),
        totalConfigs: report.total,
        supportedConfigs: report.supported
      })
      return report
    } catch (err) {
      const message = err instanceof SubscriptionError ? err.message : redact(err)
      patchSubscription({ fetching: false, lastError: message })
      throw err
    }
  })

  handle(IPC.subscriptionReveal, () => {
    const url = getVault().subscriptionUrl
    log.info(SCOPE, 'user revealed the stored subscription URL (value not logged)')
    return url
  })

  handle(IPC.subscriptionRefresh, async () => {
    const url = getVault().subscriptionUrl
    if (!url) throw new Error('ابتدا لینک اشتراک را ذخیره کنید')
    patchSubscription({ fetching: true, lastError: null })
    try {
      const report = await refreshSubscription(url)
      patchSubscription({
        fetching: false,
        lastError: null,
        lastUpdated: Date.now(),
        totalConfigs: report.total,
        supportedConfigs: report.supported
      })
      return report
    } catch (err) {
      const message = toLString(err)
      patchSubscription({ fetching: false, lastError: message })
      throw err
    }
  })

  handle(IPC.subscriptionClear, async () => {
    if (manager.isConnected) await manager.disconnect('subscription-cleared')
    wipeVault()
    clearSecrets()
    patchSubscription({
      hasUrl: false,
      maskedUrl: '',
      lastUpdated: null,
      lastError: null,
      totalConfigs: 0,
      supportedConfigs: 0,
      fetching: false
    })
    patchState({ activeServerId: null, activeServerName: null, activeServerAddressMasked: null })
    log.info(SCOPE, 'vault wiped by user request')
    return true
  })

  handle(IPC.subscriptionImportFile, async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      title: 'انتخاب فایل کانفیگ',
      buttonLabel: 'افزودن',
      properties: ['openFile'],
      filters: [
        { name: 'Text / subscription', extensions: ['txt', 'text', 'conf', 'json', 'sub'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return { imported: 0 }
    const path = result.filePaths[0]
    if (!existsSync(path)) throw new AppError(L('فایل پیدا نشد', 'File not found'))
    const text = readFileSync(path, 'utf8')
    registerSecret(text, 'import')
    const report = importPayload(text)
    syncSubscriptionCounts()
    return report
  })

  /* --------------------------------------------------------- connection */
  handle(IPC.connect, async (serverId?: string) => {
    await manager.connect(serverId)
    rebuildMenu()
    return getState().connection
  })
  handle(IPC.disconnect, async () => {
    await manager.disconnect()
    rebuildMenu()
    return getState().connection
  })

  /* ---------------------------------------------------------- settings */
  handle(IPC.settingsGet, () => getSettings())
  handle(IPC.settingsSet, async (patch: Partial<Settings>) => {
    const next = updateSettings(patch)
    setLogLevel(next.logLevel)
    applyAutoStart(next.autoStart)
    patchState({
      socksPort: next.socksPort,
      httpPort: next.httpPort,
      systemProxyEnabled: next.applySystemProxy
    })
    manager.scheduleAutoRefresh()
    patchSubscription({ autoRefreshMinutes: next.autoRefreshMinutes })
    return next
  })

  /* -------------------------------------------------------------- core */
  handle(IPC.coreEnsure, async () => {
    await manager.ensureCore()
    return getState().core
  })
  handle(IPC.corePick, async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      title: 'انتخاب فایل اجرایی Xray',
      buttonLabel: 'انتخاب',
      properties: ['openFile'],
      filters: [{ name: 'Xray core', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return getState().core
    await manager.setCustomCore(path)
    updateSettings({ corePath: path })
    return getState().core
  })
  handle(IPC.coreCheckUpdate, async () => manager.checkCoreUpdate())

  /* -------------------------------------------------------------- logs */
  handle(IPC.logsGet, () => getLogs())
  handle(IPC.logsClear, () => {
    clearLogs()
    return true
  })

  /* ------------------------------------------------------------ window */
  handle(IPC.windowMinimize, () => {
    getWindow()?.minimize()
    return true
  })
  handle(IPC.windowMaximize, () => {
    const win = getWindow()
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  handle(IPC.windowClose, () => {
    const win = getWindow()
    if (!win) return true
    if (getSettings().minimizeToTray && !runtime.quitting) {
      win.hide()
      return false
    }
    win.close()
    return true
  })

  /* ------------------------------------------------------------- shell */
  handle(IPC.shellOpen, async (url: string) => {
    if (!isAllowedExternalUrl(url)) {
      log.warn(SCOPE, 'blocked external link request')
      throw new AppError(L('باز کردن این آدرس مجاز نیست', 'Opening this address is not allowed'))
    }
    await shell.openExternal(url)
    return true
  })

  handle(IPC.clipboardWrite, async (payload: { kind: 'link' | 'text'; serverId?: string }) => {
    if (payload.kind === 'link') {
      const server = getVault().servers.find((s) => s.id === payload.serverId)
      if (!server?.raw) throw new AppError(L('لینک این کانفیگ در دسترس نیست', 'The link for this config is unavailable'))
      clipboard.writeText(server.raw)
      log.info(SCOPE, 'a config link was copied to the clipboard (contents not logged)')
      return true
    }
    clipboard.writeText(redact(payload.serverId ?? ''))
    return true
  })

  /* ------------------------------------------------------- log streaming */
  onLog((entry: LogEntry) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(IPC.logsChanged, entry)
  })
}

function listServers(reveal: boolean): ServerView[] {
  return getVault().servers.map((s) => toServerView(s, reveal))
}

export function syncSubscriptionCounts(): void {
  const vault = getVault()
  patchSubscription({
    hasUrl: Boolean(vault.subscriptionUrl),
    maskedUrl: maskUrl(vault.subscriptionUrl),
    lastUpdated: vault.lastUpdatedAt,
    totalConfigs: vault.servers.length,
    supportedConfigs: vault.servers.filter((s) => s.supported).length,
    autoRefreshMinutes: getSettings().autoRefreshMinutes
  })
}

function applyAutoStart(enabled: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: enabled ? ['--autostart'] : []
    })
  } catch (err) {
    log.warn(SCOPE, 'could not change auto-start', err)
  }
}

export function bootstrapSettings(): Settings {
  const settings = loadSettings()
  setLogLevel(settings.logLevel)
  patchState({
    socksPort: settings.socksPort,
    httpPort: settings.httpPort,
    systemProxyEnabled: settings.applySystemProxy
  })
  return settings
}

export function persistAll(): void {
  persistNow()
}

export { purgeDownloadedCores }
