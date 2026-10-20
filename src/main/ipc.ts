/**
 * IPC surface.
 *
 * Every handler returns an envelope so the renderer never has to guess whether
 * a rejection was a bug or an expected failure. Sensitive values are masked
 * before they cross the bridge; `serversReveal` is the single, explicit
 * exception and it is guarded by a user action.
 */
import { BrowserWindow, app, clipboard, dialog, ipcMain, shell } from 'electron'
import { IPC, type LogEntry, type LString, type ServerView, type Settings } from '../shared/bridge'
import { AppError, L, toLString } from '../shared/i18n'
import { getState, patchState, setSubscriptionFetching, syncSubscriptions, toast, toServerView } from './state'
import { getSettings, loadSettings, updateSettings } from './lib/settings'
import { getVault, persistNow, replaceServers, updateVault, vaultEncryptionKind, wipeVault } from './lib/secretStore'
import { log, getLogs, clearLogs, onLog, setLogLevel } from './lib/logger'
import { redact, registerSecret, clearSecrets } from './lib/redact'
import { refreshFileSubscription, refreshSubscription, subscriptionIdFor, type FetchReport } from './lib/subscription'
import { measureThroughput } from './lib/net'
import { manager } from './lib/xray/manager'
import { restoreSystemProxy } from './lib/systemProxy'
import { pickBestServer } from './lib/autoselect'
import { AUTO_SERVER_ID } from '../shared/bridge'
import { rebuildMenu } from './tray'
import { runtime } from './runtime'
import { isAllowedExternalUrl } from './window'
import { purgeDownloadedCores } from './lib/xray/core'
import { checkAppUpdate } from './lib/update'
import { checkForUpdates, installNow } from './lib/updater'

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

  handle(IPC.appUpdate, async () => {
    const info = await checkAppUpdate()
    // Kick the self-update pipeline immediately: electron-updater downloads
    // the package and restarts the app once — no browser, no repo link.
    if (info.updateAvailable) void checkForUpdates()
    return info
  })
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
  handle(IPC.serversPin, (id: string) => {
    const vault = getVault()
    const pinned = vault.pinned.includes(id)
      ? vault.pinned.filter((entry) => entry !== id)
      : [...vault.pinned, id]
    updateVault({ pinned })
    log.info(SCOPE, `server pin toggled (${pinned.includes(id) ? 'pinned' : 'unpinned'})`)
    return pinned
  })

  handle(IPC.panic, () => panicNow())

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
    const id = subscriptionIdFor(trimmed)
    registerSecret(trimmed, 'subscription')
    const vault = getVault()
    if (!vault.subscriptions.some((sub) => sub.id === id)) {
      updateVault({
        subscriptions: [
          ...vault.subscriptions,
          { id, url: trimmed, name: null, userinfo: null, updatedAt: null, lastError: null }
        ]
      })
    }
    return refreshOne(id)
  })

  handle(IPC.subscriptionRefresh, async (id?: string) => {
    const vault = getVault()
    const targets = id ? vault.subscriptions.filter((sub) => sub.id === id) : vault.subscriptions
    if (targets.length === 0) {
      throw new AppError(L('ابتدا یک اشتراک اضافه کنید', 'Add a subscription first'))
    }
    const reports: FetchReport[] = []
    let firstError: unknown = null
    for (const target of targets) {
      try {
        reports.push(await refreshOne(target.id))
      } catch (err) {
        firstError = firstError ?? err
      }
    }
    if (firstError && (Boolean(id) || reports.length === 0)) throw firstError
    return reports
  })

  handle(IPC.subscriptionRemove, async (id: string) => {
    const vault = getVault()
    const owned = vault.servers.filter((server) => server.subscriptionId === id)
    if (manager.isConnected && owned.some((server) => server.id === getState().activeServerId)) {
      await manager.disconnect('subscription-removed')
    }
    const remaining = vault.servers.filter((server) => server.subscriptionId !== id)
    updateVault({
      subscriptions: vault.subscriptions.filter((sub) => sub.id !== id),
      selectedServerId:
        vault.selectedServerId && remaining.some((server) => server.id === vault.selectedServerId)
          ? vault.selectedServerId
          : (remaining.find((server) => server.supported)?.id ?? null)
    })
    replaceServers(remaining)
    syncSubscriptions()
    rebuildMenu()
    log.info(SCOPE, `subscription removed with ${owned.length} configs`)
    return true
  })

  handle(IPC.subscriptionReveal, (id: string) => {
    const entry = getVault().subscriptions.find((sub) => sub.id === id)
    log.info(SCOPE, 'user revealed a stored subscription source (value not logged)')
    return entry?.filePath ?? entry?.url ?? null
  })

  handle(IPC.speedTest, async () => {
    if (!manager.isConnected) {
      throw new AppError(L('برای تست سرعت ابتدا متصل شوید', 'Connect first to run a speed test'))
    }
    const state = getState()
    const targets = [
      'https://speed.cloudflare.com/__down?bytes=16000000',
      'https://proof.ovh.net/files/10Mb.dat'
    ]
    for (const target of targets) {
      const result = await measureThroughput('127.0.0.1', state.httpPort, target)
      if (result.ok && result.ms > 0) {
        const mbps = (result.bytes * 8) / result.ms / 1000
        return { mbps: Math.round(mbps * 10) / 10, bytes: result.bytes, ms: result.ms }
      }
    }
    throw new AppError(
      L('تست سرعت ناموفق بود؛ سرورهای اندازه‌گیری در دسترس نیستند', 'Speed test failed — measurement servers are unreachable')
    )
  })

  handle(IPC.subscriptionClear, async () => {
    if (manager.isConnected) await manager.disconnect('subscription-cleared')
    wipeVault()
    clearSecrets()
    syncSubscriptions()
    patchState({ activeServerId: null, activeServerName: null, activeServerAddressMasked: null })
    log.info(SCOPE, 'vault wiped by user request')
    return true
  })

  handle(IPC.subscriptionImportFile, async (filePath?: string | null, password?: string | null) => {
    let target = filePath ?? null
    if (!target) {
      const win = getWindow()
      const result = await dialog.showOpenDialog(win ?? undefined!, {
        title: 'انتخاب فایل کانفیگ',
        buttonLabel: 'افزودن',
        properties: ['openFile'],
        filters: [
          { name: 'Config / archive', extensions: ['txt', 'text', 'conf', 'json', 'sub', 'zip'] },
          { name: 'All files', extensions: ['*'] }
        ]
      })
      if (result.canceled || !result.filePaths[0]) return { imported: 0 }
      target = result.filePaths[0]
    }
    const report = await refreshFileSubscription(target, password ?? null)
    syncSubscriptions()
    rebuildMenu()
    return report
  })

  /* --------------------------------------------------------- connection */
  handle(IPC.connect, async (serverId?: string) => {
    let target = serverId ?? getVault().selectedServerId ?? undefined
    if (target === AUTO_SERVER_ID) {
      const best = pickBestServer(getVault().servers)
      if (!best) throw new AppError(L('سرور پشتیبانی‌شده‌ای برای انتخاب خودکار وجود ندارد', 'No supported server is available for auto selection'))
      log.info(SCOPE, `auto selection picked ${best.name}`)
      toast('info', L(`انتخاب خودکار: ${best.name}`, `Auto-picked: ${best.name}`))
      target = best.id
    }
    await manager.connect(target)
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

/** Refresh a single stored subscription and keep state + vault in sync. */
async function refreshOne(id: string): Promise<FetchReport> {
  const entry = getVault().subscriptions.find((sub) => sub.id === id)
  if (!entry) throw new AppError(L('اشتراک پیدا نشد', 'Subscription not found'))
  setSubscriptionFetching(id, true)
  try {
    const report = entry.filePath
      ? await refreshFileSubscription(entry.filePath, entry.password ?? null)
      : await refreshSubscription(entry.url)
    if (report.needPassword) {
      const message = L(
        'این فایل رمز دارد؛ رمز را از «وارد کردن از فایل» وارد کنید تا ذخیره شود',
        'This file is password-protected; enter its password via "Import from file" so it can be stored'
      )
      updateVault({
        subscriptions: getVault().subscriptions.map((sub) => (sub.id === id ? { ...sub, lastError: message } : sub))
      })
      syncSubscriptions()
      throw new AppError(message)
    }
    syncSubscriptions()
    rebuildMenu()
    return report
  } catch (err) {
    const message = toLString(err)
    updateVault({
      subscriptions: getVault().subscriptions.map((sub) =>
        sub.id === id ? { ...sub, lastError: message } : sub
      )
    })
    syncSubscriptions()
    throw err
  } finally {
    setSubscriptionFetching(id, false)
  }
}

function listServers(reveal: boolean): ServerView[] {
  const pinned = new Set(getVault().pinned)
  return getVault().servers.map((s) => toServerView(s, reveal, pinned.has(s.id)))
}

/** Immediate emergency stop: disconnect, force the system proxy off, toast. */
export async function panicNow(): Promise<boolean> {
  log.warn(SCOPE, 'PANIC triggered — emergency disconnect')
  try {
    if (manager.isConnected) await manager.disconnect('panic')
  } catch (err) {
    log.error(SCOPE, 'panic disconnect failed', err)
  }
  try {
    await restoreSystemProxy()
  } catch (err) {
    log.error(SCOPE, 'panic could not restore system proxy', err)
  }
  patchState({ systemProxyApplied: false })
  toast('warning', L('قطع اضطراری انجام شد', 'Panic disconnect completed'))
  return true
}

export function syncSubscriptionCounts(): void {
  syncSubscriptions()
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
