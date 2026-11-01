/**
 * Naxlo — main process entry point.
 *
 * Boot order matters: logging first (so nothing is lost), then the encrypted
 * vault, then the window, then the Xray supervisor. Shutdown is the mirror
 * image and always restores the user's system proxy.
 */
import { app, BrowserWindow, dialog, globalShortcut } from 'electron'
import { createMainWindow } from './window'
import { destroyTray, initTray, rebuildMenu, setTrayWindow, showWindow } from './tray'
import {
  bootstrapSettings,
  panicNow,
  persistAll,
  registerIpc,
  syncSubscriptionCounts
} from './ipc'
import { initLogger, log, closeLogger } from './lib/logger'
import { loadVault, getVault, updateVault } from './lib/secretStore'
import { getSettings } from './lib/settings'
import { patchState, setConnection, setSubscriptionFetching, subscribeToState, syncSubscriptions } from './state'
import { manager } from './lib/xray/manager'
import { pickBestServer } from './lib/autoselect'
import { toast } from './state'
import { L } from '../shared/i18n'
import { refreshSubscription, SubscriptionError } from './lib/subscription'
import { redact } from './lib/redact'
import { runtime } from './runtime'
import { checkForUpdatesOnLaunch, initAutoUpdater } from './lib/updater'

const SCOPE = 'main'

let mainWindow: BrowserWindow | null = null
let cleaning = false

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    runtime.secondInstanceAt = Date.now()
    showWindow()
  })
}

app.setName('Naxlo')
if (process.platform === 'win32') app.setAppUserModelId('com.naxlo.desktop')
runtime.autoStarted = process.argv.includes('--autostart')
runtime.tunElevated = process.argv.includes('--tun-elevated')

async function bootstrap(): Promise<void> {
  initLogger(getSettings().logLevel)
  log.info(SCOPE, `naxlo ${app.getVersion()} starting (electron ${process.versions.electron})`)

  const settings = bootstrapSettings()
  loadVault()
  syncSubscriptionCounts()

  mainWindow = createMainWindow()
  attachCloseGuard(mainWindow)
  registerIpc(() => mainWindow)
  initTray(mainWindow, () => void requestQuit())

  await manager.init()
  manager.autoRefreshHandler = autoRefreshSubscription
  manager.failoverHandler = (failedId) => {
    if (!getSettings().autoFailover) return
    const next = pickBestServer(getVault().servers, [failedId])
    if (!next) return
    const failed = getVault().servers.find((server) => server.id === failedId)
    log.warn(SCOPE, `failover: ${failed?.name ?? failedId} → ${next.name}`)
    toast('warning', L('سرور قبلی پاسخ نداد؛ سوییچ خودکار', 'Previous server stopped answering — auto switch'), L(next.name, next.name))
    void manager.connect(next.id)
  }

  try {
    globalShortcut.register('CommandOrControl+Alt+Q', () => {
      void panicNow()
    })
  } catch (err) {
    log.warn(SCOPE, 'could not register the panic hotkey', err)
  }

  subscribeToState(() => rebuildMenu())

  patchState({
    socksPort: settings.socksPort,
    httpPort: settings.httpPort,
    systemProxyEnabled: settings.applySystemProxy,
    selectedServerId: getVault().selectedServerId
  })
  syncSubscriptions()

  initAutoUpdater()
  checkForUpdatesOnLaunch()

  if (runtime.autoStarted && settings.autoConnectLast && getVault().selectedServerId) {
    log.info(SCOPE, 'auto-connecting to the last used server')
    setConnection('preparing')
    void manager.connect()
  }

  if (runtime.tunElevated && settings.connectionMode === 'tun' && getVault().selectedServerId) {
    log.info(SCOPE, 'elevated relaunch: auto-connecting in TUN mode')
    setConnection('preparing')
    void manager.connect()
  }
}

async function autoRefreshSubscription(): Promise<void> {
  const subs = getVault().subscriptions
  if (subs.length === 0) return
  for (const sub of subs) {
    setSubscriptionFetching(sub.id, true)
    try {
      await refreshSubscription(sub.url)
      log.info(SCOPE, `auto-refresh completed (${sub.id})`)
    } catch (err) {
      const message = err instanceof SubscriptionError ? err.message : redact(err)
      updateVault({
        subscriptions: getVault().subscriptions.map((entry) =>
          entry.id === sub.id ? { ...entry, lastError: message } : entry
        )
      })
      log.warn(SCOPE, `auto-refresh failed (${sub.id})`, message)
    } finally {
      setSubscriptionFetching(sub.id, false)
    }
  }
  syncSubscriptions()
}

async function cleanup(): Promise<void> {
  if (cleaning) return
  cleaning = true
  log.info(SCOPE, 'shutting down')
  try {
    globalShortcut.unregisterAll()
    await manager.shutdown()
  } catch (err) {
    log.error(SCOPE, 'manager shutdown failed', err)
  }
  try {
    persistAll()
    destroyTray()
  } catch (err) {
    log.error(SCOPE, 'final persist failed', err)
  }
  closeLogger()
}

async function quit(): Promise<void> {
  runtime.quitting = true
  await cleanup()
  app.exit(0)
}

/** Tray/window close while a tunnel is up: warn first, then act. */
async function requestQuit(): Promise<void> {
  if (runtime.quitting) return
  if (manager.isConnected) {
    await confirmCloseWhileConnected()
    return
  }
  await quit()
}

/** Close while connected must warn first; otherwise honour minimize-to-tray. */
function attachCloseGuard(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (runtime.quitting) return
    if (manager.isConnected) {
      event.preventDefault()
      void confirmCloseWhileConnected()
      return
    }
    if (getSettings().minimizeToTray) {
      event.preventDefault()
      win.hide()
    }
  })
}

async function confirmCloseWhileConnected(): Promise<void> {
  const win = mainWindow
  if (!win) return
  const faLang = getSettings().language === 'fa'
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    noLink: true,
    defaultId: 0,
    cancelId: 2,
    message: faLang ? 'اتصال هنوز برقرار است!' : 'You are still connected!',
    detail: faLang
      ? 'پروکسی/تونل ناکسلو فعال است. قبل از بستن برنامه خاموشش کنیم؟'
      : 'The Naxlo proxy/tunnel is still active. Turn it off before closing?',
    buttons: faLang
      ? ['خاموش کن و ببند', 'متصل بمان و ببند', 'لغو']
      : ['Disconnect and close', 'Stay connected and close', 'Cancel']
  })
  if (response === 0) {
    runtime.quitting = true
    try {
      await manager.disconnect('user')
    } catch {
      /* cleanup() inside quit() handles the rest */
    }
    await quit()
  } else if (response === 1) {
    win.hide()
  }
}

app.whenReady().then(() => {
  void bootstrap().catch((err) => {
    // Nothing is guaranteed to be initialised here, so stay defensive.
    try {
      log.error(SCOPE, 'bootstrap failed', err)
    } catch {
      /* logger not ready */
    }
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      attachCloseGuard(mainWindow)
      setTrayWindow(mainWindow)
    } else {
      showWindow()
    }
  })
})

app.on('before-quit', (event) => {
  if (cleaning) return
  event.preventDefault()
  void quit()
})

app.on('window-all-closed', () => {
  // With the tray enabled the app keeps running (the proxy must survive).
  if (process.platform !== 'darwin' && !getSettings().minimizeToTray) void quit()
})

process.on('uncaughtException', (err) => {
  log.error(SCOPE, 'uncaught exception', err)
})
process.on('unhandledRejection', (reason) => {
  log.error(SCOPE, 'unhandled rejection', reason)
})
