/**
 * Naxlo — main process entry point.
 *
 * Boot order matters: logging first (so nothing is lost), then the encrypted
 * vault, then the window, then the Xray supervisor. Shutdown is the mirror
 * image and always restores the user's system proxy.
 */
import { app, BrowserWindow, globalShortcut } from 'electron'
import { createMainWindow } from './window'
import { destroyTray, initTray, rebuildMenu, showWindow } from './tray'
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

async function bootstrap(): Promise<void> {
  initLogger(getSettings().logLevel)
  log.info(SCOPE, `naxlo ${app.getVersion()} starting (electron ${process.versions.electron})`)

  const settings = bootstrapSettings()
  loadVault()
  syncSubscriptionCounts()

  mainWindow = createMainWindow()
  registerIpc(() => mainWindow)
  initTray(mainWindow, () => void quit())

  mainWindow.on('close', (event) => {
    if (getSettings().minimizeToTray && !runtime.quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

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
