/**
 * Windows system proxy (WinINET) management.
 *
 * Naxlo deliberately avoids TUN/Wintun: it runs Xray with local SOCKS/HTTP
 * inbounds and, optionally, points Windows at the HTTP inbound. The previous
 * values are captured before touching anything and restored on disconnect, so
 * the user's network configuration always comes back intact — even after a
 * crash (the backup is persisted in userData).
 */
import { app } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { log } from './logger'
import { AppError, L } from '../../shared/i18n'

const SCOPE = 'system-proxy'
const BACKUP_FILE = 'proxy-backup.json'

/** Hosts that must never go through the proxy (loopback safety). */
const BYPASS =
  'localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.2*.*;172.30.*;172.31.*;192.168.*;::1;<local>'

interface Backup {
  proxyEnable: number
  proxyServer: string
  proxyOverride: string
  autoConfigUrl: string
  capturedAt: number
}

let cachedBackup: Backup | null = null

function backupPath(): string {
  return join(app.getPath('userData'), BACKUP_FILE)
}

function loadBackup(): Backup | null {
  if (cachedBackup) return cachedBackup
  try {
    const p = backupPath()
    if (existsSync(p)) cachedBackup = JSON.parse(readFileSync(p, 'utf8')) as Backup
  } catch (err) {
    log.warn(SCOPE, 'could not read proxy backup', err)
  }
  return cachedBackup
}

function saveBackup(backup: Backup | null): void {
  cachedBackup = backup
  try {
    const p = backupPath()
    if (!backup) {
      if (existsSync(p)) rmSync(p)
      return
    }
    writeFileSync(p, JSON.stringify(backup, null, 2), { mode: 0o600 })
  } catch (err) {
    log.warn(SCOPE, 'could not persist proxy backup', err)
  }
}

function encodeCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

function runPowerShell(script: string, timeoutMs = 12000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      reject(new AppError(L('تنظیم پروکسی سیستم فقط روی ویندوز پشتیبانی می‌شود', 'System proxy is only supported on Windows')))
      return
    }
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encodeCommand(script)
    ]
    const child = spawn('powershell.exe', args, { windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new AppError(L('پایان مهلت اجرای PowerShell', 'PowerShell execution timed out')))
    }, timeoutMs)
    child.stdout.on('data', (d) => (out += d.toString('utf8')))
    child.stderr.on('data', (d) => (err += d.toString('utf8')))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, out, err })
    })
  })
}

const REFRESH_SNIPPET = `
$__sig = '[DllImport("wininet.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);'
$__t = Add-Type -MemberDefinition $__sig -Name 'NaxloWinINet' -Namespace 'Naxlo.Native' -PassThru
[void]$__t::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)
[void]$__t::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)
`

export interface SystemProxyState {
  applied: boolean
  server: string | null
}

export async function readSystemProxy(): Promise<SystemProxyState> {
  if (process.platform !== 'win32') return { applied: false, server: null }
  const script = `
$p = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
$c = Get-ItemProperty -Path $p
[pscustomobject]@{ ProxyEnable = [int]$c.ProxyEnable; ProxyServer = [string]$c.ProxyServer } | ConvertTo-Json -Compress
`
  try {
    const { out } = await runPowerShell(script)
    const json = out.trim().split(/\r?\n/).filter(Boolean).pop()
    if (!json) return { applied: false, server: null }
    const data = JSON.parse(json) as { ProxyEnable: number; ProxyServer: string }
    return { applied: data.ProxyEnable === 1, server: data.ProxyServer || null }
  } catch (err) {
    log.warn(SCOPE, 'could not read current proxy state', err)
    return { applied: false, server: null }
  }
}

/** Point WinINET at Naxlo's HTTP inbound, keeping a restorable backup. */
export async function applySystemProxy(host: string, port: number): Promise<void> {
  const server = `${host}:${port}`
  const current = loadBackup()
  const script = `
$p = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
$c = Get-ItemProperty -Path $p
[pscustomobject]@{
  proxyEnable = $(if ($null -eq $c.ProxyEnable) { 0 } else { [int]$c.ProxyEnable })
  proxyServer = [string]$c.ProxyServer
  proxyOverride = [string]$c.ProxyOverride
  autoConfigUrl = [string]$c.AutoConfigUrl
  capturedAt = $([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
} | ConvertTo-Json -Compress
Set-ItemProperty -Path $p -Name ProxyEnable -Value 1 -Type DWord
Set-ItemProperty -Path $p -Name ProxyServer -Value '${server}'
Set-ItemProperty -Path $p -Name ProxyOverride -Value '${BYPASS}'
${REFRESH_SNIPPET}
`
  const { code, out, err } = await runPowerShell(script)
  if (code !== 0) {
    log.error(SCOPE, 'apply failed', err || out)
    throw new AppError(L('تنظیم پروکسی سیستم ناموفق بود', 'Applying the system proxy failed'))
  }
  if (!current) {
    try {
      const json = out.trim().split(/\r?\n/).filter(Boolean)[0]
      if (json) saveBackup(JSON.parse(json) as Backup)
    } catch (parseErr) {
      log.warn(SCOPE, 'could not parse proxy backup', parseErr)
    }
  }
  log.info(SCOPE, `system proxy applied -> ${server}`)
}

/** Restore whatever the user had before Naxlo touched it. */
export async function restoreSystemProxy(): Promise<void> {
  if (process.platform !== 'win32') return
  const backup = loadBackup()
  const script = `
$p = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
Set-ItemProperty -Path $p -Name ProxyEnable -Value ${backup ? backup.proxyEnable : 0} -Type DWord
Set-ItemProperty -Path $p -Name ProxyServer -Value '${backup?.proxyServer ?? ''}'
Set-ItemProperty -Path $p -Name ProxyOverride -Value '${backup?.proxyOverride ?? ''}'
${REFRESH_SNIPPET}
`
  try {
    const { code, err, out } = await runPowerShell(script)
    if (code !== 0) log.warn(SCOPE, 'restore returned non-zero', err || out)
    saveBackup(null)
    log.info(SCOPE, 'system proxy restored')
  } catch (error) {
    log.error(SCOPE, 'restore failed', error)
    throw error
  }
}

/** Best-effort cleanup used when the app starts after an unclean exit. */
export async function reconcileOnStartup(expectedServer: string | null): Promise<void> {
  if (process.platform !== 'win32') return
  const backup = loadBackup()
  if (!backup) return
  const state = await readSystemProxy()
  if (state.applied && state.server && state.server !== expectedServer) {
    // Something else owns the proxy now — leave it alone but drop our backup.
    log.info(SCOPE, 'proxy is owned by another application; leaving it untouched')
    saveBackup(null)
    return
  }
  if (state.applied && state.server === expectedServer) {
    await restoreSystemProxy()
  }
}
