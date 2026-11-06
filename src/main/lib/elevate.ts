/**
 * Administrator elevation for TUN mode.
 *
 * Creating a Wintun adapter and system routes needs admin rights. When the
 * user switches to TUN mode without them, the app relaunches itself once
 * through the Windows UAC prompt (`Start-Process -Verb RunAs`) with the
 * `--tun-elevated` flag; the fresh instance owns the connection lifecycle so
 * connect/disconnect never trigger another prompt.
 *
 * The relaunch is *confirmed*: the PowerShell exit code tells us whether the
 * UAC prompt was accepted. A dismissed prompt keeps the current instance
 * alive instead of silently closing the app.
 */
import { app } from 'electron'
import { execSync } from 'node:child_process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { log } from './logger'

const execFileAsync = promisify(execFile)

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
 * Relaunch the packaged app elevated (UAC). Resolves `true` only when the
 * UAC prompt was accepted — the caller then lets this instance exit while
 * the elevated one takes over; `false` means "stay put".
 */
export async function relaunchElevated(): Promise<boolean> {
  if (!app.isPackaged) {
    log.warn(SCOPE, 'elevated relaunch is only available in packaged builds')
    return false
  }
  if (process.platform !== 'win32') return false
  const exe = process.execPath.replace(/'/g, "''")
  const script = `Start-Process -FilePath '${exe}' -ArgumentList '--tun-elevated' -Verb RunAs`
  // Release the single-instance lock *before* the elevated process spawns,
  // otherwise it would see us holding it and quit as a "second instance".
  app.releaseSingleInstanceLock()
  try {
    // A dismissed UAC prompt makes Start-Process throw → non-zero exit here.
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
      windowsHide: true,
      timeout: 120_000
    })
  } catch (err) {
    log.warn(SCOPE, 'elevated relaunch cancelled or failed', err instanceof Error ? err.message : err)
    try {
      app.requestSingleInstanceLock()
    } catch {
      /* another instance took over meanwhile — nothing sensible to do */
    }
    return false
  }
  log.info(SCOPE, 'relaunching elevated for TUN mode')
  setTimeout(() => app.exit(0), 350)
  return true
}
