/**
 * Automatic application updates (GitHub provider, electron-updater).
 *
 * Behaviour the user asked for: on launch, Naxlo asks GitHub whether a newer
 * release exists; if yes it downloads it silently in the background and, once
 * the package is verified (sha512 from `latest.yml`), restarts itself exactly
 * once to install — the installer then launches the new version.
 *
 * The browser is never opened (web installer disabled): the only update path
 * is download → verify → silent install → single restart.
 *
 * In development (`app.isPackaged === false`) everything is a no-op so hot
 * reload keeps working.
 */
import { app } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { log } from './logger'
import { L } from '../../shared/i18n'
import { getSettings } from './settings'
import { patchUpdate, toast } from '../state'

const SCOPE = 'updater'

let initialised = false
let installTimer: NodeJS.Timeout | null = null
let retryScheduled = false

export function initAutoUpdater(): void {
  if (initialised) return
  initialised = true

  if (!app.isPackaged) {
    log.info(SCOPE, 'auto-update disabled in development builds')
    return
  }

  try {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false
    autoUpdater.disableWebInstaller = true
    // Installers are published unsigned; integrity comes from the sha512
    // checksums inside latest.yml, which electron-updater always verifies.
    autoUpdater.on('checking-for-update', () => {
      log.info(SCOPE, 'checking for updates…')
      patchUpdate({ checking: true, error: null })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info(SCOPE, `update available: ${info.version}`)
      patchUpdate({ availableVersion: info.version, downloading: true, error: null })
      toast(
        'info',
        L('نسخهٔ جدید پیدا شد', 'Update found'),
        L(
          `نسخهٔ ${info.version} در حال دانلود است…`,
          `Version ${info.version} is downloading in the background…`
        )
      )
    })

    autoUpdater.on('update-not-available', () => {
      log.info(SCOPE, 'no update available')
      patchUpdate({ checking: false, downloading: false, progress: null })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      patchUpdate({ downloading: true, progress: progress.percent / 100 })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info(SCOPE, `update downloaded: ${info.version}`)
      patchUpdate({
        checking: false,
        downloading: false,
        progress: null,
        downloadedVersion: info.version,
        ready: true
      })
      toast(
        'success',
        L('به‌روزرسانی آمادهٔ نصب است', 'Update ready to install'),
        L(
          `نسخهٔ ${info.version} دانلود شد؛ برنامه یک‌بار بسته و با نسخهٔ جدید اجرا می‌شود.`,
          `Version ${info.version} downloaded. Naxlo will restart once to install it.`
        )
      )
      if (getSettings().autoUpdate) scheduleInstall(6000)
    })

    autoUpdater.on('error', (error: Error) => {
      log.warn(SCOPE, 'updater error', error?.message ?? '')
      patchUpdate({
        checking: false,
        downloading: false,
        progress: null,
        error: L('بررسی به‌روزرسانی ناموفق بود', 'Update check failed')
      })
      // Transient network hiccups are common; retry once after a short delay
      // so self-update needs no user action.
      if (!retryScheduled) {
        retryScheduled = true
        setTimeout(() => {
          retryScheduled = false
          void checkForUpdates()
        }, 45_000)
      }
    })
  } catch (err) {
    log.error(SCOPE, 'could not initialise auto-updater', err)
  }
}

/** Ask GitHub for a newer release; safe to call repeatedly. */
export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    log.warn(SCOPE, 'check failed', err)
    patchUpdate({
      checking: false,
      downloading: false,
      error: L('بررسی به‌روزرسانی ناموفق بود', 'Update check failed')
    })
  }
}

/** Called once, a few seconds after launch. */
export function checkForUpdatesOnLaunch(): void {
  if (!app.isPackaged || !getSettings().autoUpdate) return
  setTimeout(() => void checkForUpdates(), 6000)
}

export function scheduleInstall(delayMs = 0): void {
  if (!app.isPackaged) return
  if (installTimer) clearTimeout(installTimer)
  installTimer = setTimeout(() => {
    installNow()
  }, delayMs)
}

/** Quit and run the downloaded installer; it relaunches the app. */
export function installNow(): void {
  if (!app.isPackaged) return
  log.info(SCOPE, 'quitting to install update')
  try {
    autoUpdater.quitAndInstall(true, true)
  } catch (err) {
    log.error(SCOPE, 'quitAndInstall failed', err)
    patchUpdate({ error: L('نصب به‌روزرسانی ناموفق بود', 'Update installation failed') })
  }
}
