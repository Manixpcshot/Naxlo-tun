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
import { manager } from './lib/xray/manager'
import { log } from './lib/logger'
import type { ConnectionState } from '../shared/bridge'

const SCOPE = 'tray'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let quitRequested = false
let quitHandler: (() => void) | null = null

const STATE_LABEL: Record<ConnectionState, string> = {
  idle: 'متصل نیست',
  preparing: 'در حال آماده‌سازی',
  starting: 'در حال راه‌اندازی پروکسی',
  connected: 'متصل',
  stopping: 'در حال قطع',
  error: 'خطا',
  'core-missing': 'هستهٔ Xray نصب نشده'
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
  const menu = Menu.buildFromTemplate([
    {
      label: `Naxlo — ${STATE_LABEL[state.connection]}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'اتصال',
      enabled: !connected && state.connection !== 'starting' && state.connection !== 'preparing',
      click: () => void manager.connect()
    },
    {
      label: 'قطع اتصال',
      enabled: connected || state.connection === 'error',
      click: () => void manager.disconnect()
    },
    { type: 'separator' },
    { label: 'باز کردن پنجره', click: () => showWindow() },
    {
      label: 'خروج',
      click: () => {
        quitRequested = true
        quitHandler?.()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.setToolTip(`Naxlo — ${STATE_LABEL[state.connection]}`)
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
