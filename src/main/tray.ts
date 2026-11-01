/**
 * Tray icon + quick menu.
 *
 * The tray gives Naxlo the behaviour users expect from a proxy client: closing
 * the window keeps the session alive, and the current state is always one click
 * away. Tooltips never contain server details.
 */
import { Menu, Tray, app, nativeImage, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getState } from './state'
import { getSettings } from './lib/settings'
import { manager } from './lib/xray/manager'
import { log } from './lib/logger'
import type { ConnectionState } from '../shared/bridge'

const SCOPE = 'tray'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let quitRequested = false
let quitHandler: (() => void) | null = null

/** Tray strings follow the app language (fa / en / tr). */
const STATE_LABEL: Record<string, Record<ConnectionState, string>> = {
  fa: {
    idle: 'متصل نیست',
    preparing: 'در حال آماده‌سازی',
    starting: 'در حال راه‌اندازی پروکسی',
    connected: 'متصل',
    stopping: 'در حال قطع',
    error: 'خطا',
    'core-missing': 'هستهٔ Xray نصب نشده'
  },
  en: {
    idle: 'Not connected',
    preparing: 'Preparing',
    starting: 'Starting proxy',
    connected: 'Connected',
    stopping: 'Disconnecting',
    error: 'Error',
    'core-missing': 'Xray core not installed'
  },
  tr: {
    idle: 'Bağlı değil',
    preparing: 'Hazırlanıyor',
    starting: 'Proxy başlatılıyor',
    connected: 'Bağlı',
    stopping: 'Bağlantı kesiliyor',
    error: 'Hata',
    'core-missing': 'Xray çekirdeği kurulu değil'
  }
}

const TRAY_TEXT: Record<string, { connect: string; disconnect: string; open: string; quit: string; panic: string }> = {
  fa: { connect: 'اتصال', disconnect: 'قطع اتصال', open: 'باز کردن پنجره', quit: 'خروج', panic: 'قطع اضطراری' },
  en: { connect: 'Connect', disconnect: 'Disconnect', open: 'Open window', quit: 'Quit', panic: 'Panic disconnect' },
  tr: { connect: 'Bağlan', disconnect: 'Bağlantıyı kes', open: 'Pencereyi aç', quit: 'Çık', panic: 'Acil kesme' }
}

function trayLang(): string {
  const lang = getSettings().language
  return lang === 'en' || lang === 'tr' ? lang : 'fa'
}

function iconPath(): string {
  const dir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'build')
  return join(dir, app.isPackaged ? 'tray.ico' : 'tray.png')
}

export function initTray(win: BrowserWindow, onQuit: () => void): void {
  mainWindow = win
  quitHandler = onQuit
  try {
    const image = nativeImage.createFromPath(iconPath())
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  } catch (err) {
    log.warn(SCOPE, 'tray could not be created', err)
    return
  }
  rebuildMenu()
  tray.on('click', () => showWindow())
  tray.on('double-click', () => showWindow())
}

export function rebuildMenu(): void {
  if (!tray || tray.isDestroyed()) return
  const state = getState()
  const connected = state.connection === 'connected'
  const labels = STATE_LABEL[trayLang()] ?? STATE_LABEL.fa
  const text = TRAY_TEXT[trayLang()] ?? TRAY_TEXT.fa
  const menu = Menu.buildFromTemplate([
    {
      label: `Naxlo — ${labels[state.connection]}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: text.connect,
      enabled: !connected && state.connection !== 'starting' && state.connection !== 'preparing',
      click: () => void manager.connect()
    },
    {
      label: text.disconnect,
      enabled: connected || state.connection === 'error',
      click: () => void manager.disconnect()
    },
    { type: 'separator' },
    { label: text.open, click: () => showWindow() },
    {
      label: text.quit,
      click: () => {
        quitRequested = true
        quitHandler?.()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.setToolTip(`Naxlo — ${labels[state.connection]}`)
}

/** Re-point the tray at a freshly created window (macOS activate). */
export function setTrayWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

export function isQuitRequested(): boolean {
  return quitRequested
}

export function setQuitRequested(value: boolean): void {
  quitRequested = value
}

export function destroyTray(): void {
  try {
    tray?.destroy()
  } catch {
    /* ignore */
  }
  tray = null
}
