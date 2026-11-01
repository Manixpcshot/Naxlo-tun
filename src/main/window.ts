/**
 * Window factory + renderer hardening.
 */
import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { log } from './lib/logger'

const SCOPE = 'window'
const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL']

export interface WindowOptions {
  width?: number
  height?: number
}

export function createMainWindow(options: WindowOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: options.width ?? 1180,
    height: options.height ?? 780,
    minWidth: 960,
    minHeight: 620,
    show: false,
    frame: false,
    title: 'Naxlo',
    backgroundColor: '#05060a',
    autoHideMenuBar: true,
    fullscreenable: true,
    maximizable: true,
    roundedCorners: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.on('closed', () => log.info(SCOPE, 'main window closed'))

  // Never let the renderer open arbitrary windows — external navigation goes
  // through the same curated allowlist as the `shell:open` bridge channel.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    } else {
      log.warn(SCOPE, 'blocked window.open attempt')
    }
    return { action: 'deny' }
  })

  // Block in-app navigation away from the bundled UI.
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : url.startsWith('file://')
    if (!allowed) {
      event.preventDefault()
      log.warn(SCOPE, 'blocked navigation attempt')
    }
  })

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/** Only allow a curated set of external links. */
const ALLOWED_EXTERNAL = [
  'github.com/Manixpcshot/Naxlo-tun',
  'github.com/XTLS/Xray-core',
  'github.com/rastikerdar/vazirmatn',
  'xray.org.cn',
  'electronjs.org',
  'react.dev'
]

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const target = `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`
    return ALLOWED_EXTERNAL.some((allowed) => target.startsWith(allowed))
  } catch {
    return false
  }
}
