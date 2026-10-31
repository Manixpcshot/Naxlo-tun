/**
 * Wintun driver provisioning for TUN mode.
 *
 * Xray's built-in TUN inbound uses the official Wintun library on Windows and
 * requires `wintun.dll` next to the core executable. We download the official
 * prebuilt ZIP from wintun.net and verify its SHA-256 before extracting — the
 * pin below is the published checksum of wintun-0.14.1.zip.
 *
 * This module intentionally avoids electron imports so the smoke tests can
 * bundle it.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { AppError, L } from '../../../shared/i18n'

export const WINTUN_VERSION = '0.14.1'
export const WINTUN_ZIP_URL = `https://www.wintun.net/builds/wintun-${WINTUN_VERSION}.zip`
/** Official SHA-256 of wintun-0.14.1.zip (published by wintun.net). */
export const WINTUN_ZIP_SHA256 = '07c256185d6ee3652e09fa55c0b673e2624b565e02c4b9091c79ca7d2f24ef51'

function archDir(): string {
  switch (process.arch) {
    case 'arm64':
      return 'arm64'
    case 'ia32':
      return 'x86'
    default:
      return 'amd64'
  }
}

export function wintunDllPath(coreDir: string): string {
  return join(coreDir, 'wintun.dll')
}

/** Make sure `wintun.dll` sits next to the core executable; download if missing. */
export async function ensureWintun(coreDir: string): Promise<string> {
  const dest = wintunDllPath(coreDir)
  if (existsSync(dest)) return dest
  mkdirSync(coreDir, { recursive: true })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2 * 60_000)
  let bytes: Uint8Array
  try {
    const response = await fetch(WINTUN_ZIP_URL, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new AppError(
      L(
        `دانلود درایور Wintun ناموفق بود (${message})`,
        `Wintun driver download failed (${message})`
      )
    )
  } finally {
    clearTimeout(timer)
  }

  const digest = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  if (digest !== WINTUN_ZIP_SHA256) {
    throw new AppError(
      L(
        'کنترل یکپارچگی درایور Wintun ناموفق بود؛ دانلود تکرار شود',
        'Wintun driver checksum verification failed — please retry the download'
      )
    )
  }

  try {
    const files = unzipSync(bytes)
    const wanted = `wintun/bin/${archDir()}/wintun.dll`
    const entry =
      Object.keys(files).find((name) => name.toLowerCase() === wanted) ??
      Object.keys(files).find((name) => /(^|\/)wintun\.dll$/i.test(name) && name.includes(archDir()))
    if (!entry) throw new Error('wintun.dll not found in the archive')
    writeFileSync(dest, Buffer.from(files[entry] as Uint8Array))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new AppError(
      L(`استخراج درایور Wintun ناموفق بود (${message})`, `Wintun driver extraction failed (${message})`)
    )
  }
  return dest
}
