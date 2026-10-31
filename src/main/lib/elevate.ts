/**
 * Administrator elevation for TUN mode.
 *
 * Creating a Wintun adapter and system routes needs admin rights. When the
 * user switches to TUN mode without them, the app relaunches itself once
 * through the Windows UAC prompt (`Start-Process -Verb RunAs`) with the
 * `--tun-elevated` flag; the fresh instance owns the connection lifecycle so
 * connect/disconnect never trigger another prompt.
 */
import { app } from 'electron'
import { execSync, spawn } from 'node:child_process'
import { log } from './logger'

const SCOPE = 'elevate'

/** True when the current process can manage adapters/routes system-wide. */
export function isAdmin(): boolean {
  if (process.platform !== 'win32') return typeof process.getuid === 'function' && process.getuid() === 0
  try {
    execSync('net session', { stdio: 'ignore', timeout: 5000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

/**
 * Relaunch the packaged app elevated (UAC). The current instance exits right
 * after spawning so the single-instance lock is released first.
 */
export function relaunchElevated(): boolean {
  if (!app.isPackaged) {
    log.warn(SCOPE, 'elevated relaunch is only available in packaged builds')
    return false
  }
  if (process.platform !== 'win32') return false
  try {
    app.releaseSingleInstanceLock()
    const exe = process.execPath.replace(/'/g, "''")
    spawn(
      'powershell.exe',
      ['-NoProfile', '-Command', `Start-Process -FilePath '${exe}' -ArgumentList '--tun-elevated' -Verb RunAs`],
      { detached: true, stdio: 'ignore', windowsHide: true }
    ).unref()
    log.info(SCOPE, 'relaunching elevated for TUN mode')
    setTimeout(() => app.exit(0), 350)
    return true
  } catch (err) {
    log.error(SCOPE, 'elevated relaunch failed', err)
    return false
  }
}
