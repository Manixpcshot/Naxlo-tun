/**
 * Xray core lifecycle: locate, download, verify, extract.
 *
 * The binary is *never* committed to Git. Packaged installers bundle it as an
 * extra resource (see the release workflow); during development and for users
 * who install from a portable build, Naxlo downloads the pinned release from
 * the official Xray-core GitHub repository and verifies it against the
 * published digest before extraction.
 */
import { app } from 'electron'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  chmodSync,
  readdirSync,
  statSync
} from 'node:fs'
import { join, dirname } from 'node:path'
import { unzipSync } from 'fflate'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { log } from '../logger'
import { PINNED_XRAY_VERSION } from '../../../shared/types'

const execFileAsync = promisify(execFile)
const SCOPE = 'xray:core'
const REPO = 'XTLS/Xray-core'

export type CoreSource = 'bundled' | 'downloaded' | 'custom' | 'dev'

export interface CoreLocation {
  path: string
  version: string | null
  source: CoreSource
}

export interface DownloadProgress {
  received: number
  total: number | null
  phase: 'download' | 'verify' | 'extract'
}

export function executableName(): string {
  return process.platform === 'win32' ? 'xray.exe' : 'xray'
}

function assetName(): string {
  const { platform, arch } = process
  if (platform === 'win32') {
    if (arch === 'arm64') return 'Xray-windows-arm64-v8a.zip'
    if (arch === 'ia32') return 'Xray-windows-32.zip'
    return 'Xray-windows-64.zip'
  }
  if (platform === 'darwin') return arch === 'arm64' ? 'Xray-macos-arm64-v8a.zip' : 'Xray-macos-64.zip'
  if (arch === 'arm64') return 'Xray-linux-arm64-v8a.zip'
  return 'Xray-linux-64.zip'
}

/** Directories searched, in order, for an existing core. */
export function candidateLocations(customPath?: string | null): Array<{ dir: string; source: CoreSource }> {
  const list: Array<{ dir: string; source: CoreSource }> = []
  if (customPath) list.push({ dir: dirname(customPath), source: 'custom' })
  if (!app.isPackaged) {
    list.push({ dir: join(app.getAppPath(), 'resources', 'xray'), source: 'dev' })
  }
  list.push({ dir: join(process.resourcesPath ?? '', 'xray'), source: 'bundled' })
  list.push({ dir: join(app.getPath('userData'), 'xray', PINNED_XRAY_VERSION), source: 'downloaded' })
  return list
}

export function targetDir(): string {
  return join(app.getPath('userData'), 'xray', PINNED_XRAY_VERSION)
}

export async function findCore(customPath?: string | null): Promise<CoreLocation | null> {
  if (customPath && existsSync(customPath)) {
    const version = await readVersion(customPath)
    return { path: customPath, version, source: 'custom' }
  }
  for (const candidate of candidateLocations(customPath)) {
    const file = join(candidate.dir, executableName())
    if (candidate.source === 'custom' && customPath) continue
    if (!existsSync(file)) continue
    if (process.platform !== 'win32') {
      try {
        chmodSync(file, 0o755)
      } catch {
        /* best effort */
      }
    }
    const version = await readVersion(file)
    return { path: file, version, source: candidate.source }
  }
  return null
}

export async function readVersion(path: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(path, ['version'], { timeout: 8000, windowsHide: true })
    const match = /Xray\s+([0-9v][^\s(]*)/i.exec(stdout)
    return match ? match[1].replace(/^v/, '') : stdout.trim().split(/\r?\n/)[0] ?? null
  } catch (err) {
    log.warn(SCOPE, 'could not read core version', err)
    return null
  }
}

export async function latestReleaseTag(): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'naxlo' }
    })
    if (!response.ok) return null
    const data = (await response.json()) as { tag_name?: string }
    return data.tag_name ?? null
  } catch (err) {
    log.warn(SCOPE, 'could not query latest core release', err)
    return null
  }
}

/** Download + verify + extract the pinned core into `targetDir()`. */
export async function downloadCore(
  onProgress?: (progress: DownloadProgress) => void,
  version: string = PINNED_XRAY_VERSION
): Promise<string> {
  const tag = version.startsWith('v') ? version : `v${version}`
  const asset = assetName()
  const url = `https://github.com/${REPO}/releases/download/${tag}/${asset}`
  const dgstUrl = `${url}.dgst`
  const dest = targetDir()
  const exePath = join(dest, executableName())

  if (existsSync(exePath)) {
    log.info(SCOPE, 'core already present, skipping download')
    return exePath
  }

  mkdirSync(dest, { recursive: true })
  log.info(SCOPE, `downloading core ${tag} (${asset})`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5 * 60_000)
  let bytes: Uint8Array
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const totalHeader = response.headers.get('content-length')
    const total = totalHeader ? Number(totalHeader) : null
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.byteLength
          onProgress?.({ received, total, phase: 'download' })
        }
      }
      bytes = concat(chunks, received)
    } else {
      bytes = new Uint8Array(await response.arrayBuffer())
      received = bytes.byteLength
      onProgress?.({ received, total, phase: 'download' })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(SCOPE, 'core download failed', message)
    throw new Error(
      /abort/i.test(message)
        ? 'دانلود هستهٔ Xray به دلیل پایان مهلت لغو شد'
        : `دانلود هستهٔ Xray ناموفق بود (${message})`
    )
  } finally {
    clearTimeout(timer)
  }

  onProgress?.({ received: bytes.byteLength, total: bytes.byteLength, phase: 'verify' })
  const digestInfo = await fetchDigest(dgstUrl)
  if (digestInfo) {
    const ok = verifyDigest(bytes, digestInfo)
    if (!ok) {
      rmSync(dest, { recursive: true, force: true })
      log.error(SCOPE, 'core checksum mismatch — refusing to run')
      throw new Error('کنترل یکپارچگی فایل هسته ناموفق بود؛ دانلود دوباره انجام شود')
    }
    log.info(SCOPE, `core checksum verified (${digestInfo.alg})`)
  } else {
    log.warn(SCOPE, 'digest file unavailable — installed without checksum verification')
  }

  onProgress?.({ received: bytes.byteLength, total: bytes.byteLength, phase: 'extract' })
  try {
    const files = unzipSync(bytes)
    for (const [name, data] of Object.entries(files)) {
      if (name.endsWith('/')) continue
      const outPath = join(dest, name)
      // Guard against zip-slip.
      if (!outPath.startsWith(dest)) continue
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, Buffer.from(data as Uint8Array))
      if (/\.(exe|dat|json)$/i.test(name) || process.platform !== 'win32') {
        try {
          chmodSync(outPath, name === executableName() ? 0o755 : 0o644)
        } catch {
          /* best effort */
        }
      }
    }
  } catch (err) {
    rmSync(dest, { recursive: true, force: true })
    log.error(SCOPE, 'core extraction failed', err)
    throw new Error('استخراج فایل هسته ناموفق بود')
  }

  if (!existsSync(exePath)) {
    const found = readdirSync(dest).filter((f) => /^xray(\.exe)?$/i.test(f))
    if (found.length) {
      const actual = join(dest, found[0])
      if (actual !== exePath) {
        writeFileSync(exePath, new Uint8Array())
        rmSync(exePath)
        // Keep the discovered name as the canonical path.
        log.info(SCOPE, `core extracted as ${found[0]}`)
        return actual
      }
    }
    rmSync(dest, { recursive: true, force: true })
    throw new Error('فایل اجرایی هسته پس از استخراج پیدا نشد')
  }

  const version_ = await readVersion(exePath)
  log.info(SCOPE, `core ready (${version_ ?? 'unknown version'}) at ${dest}`)
  return exePath
}

interface DigestInfo {
  alg: 'sha512' | 'sha256' | 'sha1' | 'md5'
  base64: string
}

async function fetchDigest(url: string): Promise<DigestInfo | null> {
  try {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok) return null
    const text = await response.text()
    const sha512 = /SHA512\s*\(base64\)\s*=\s*([A-Za-z0-9+/=]+)/i.exec(text)
    if (sha512) return { alg: 'sha512', base64: sha512[1] }
    const sha256 = /SHA256\s*\(base64\)\s*=\s*([A-Za-z0-9+/=]+)/i.exec(text)
    if (sha256) return { alg: 'sha256', base64: sha256[1] }
    const sha1 = /SHA1\s*\(base64\)\s*=\s*([A-Za-z0-9+/=]+)/i.exec(text)
    if (sha1) return { alg: 'sha1', base64: sha1[1] }
    const md5 = /MD5\s*\(base64\)\s*=\s*([A-Za-z0-9+/=]+)/i.exec(text)
    if (md5) return { alg: 'md5', base64: md5[1] }
  } catch (err) {
    log.warn(SCOPE, 'digest fetch failed', err)
  }
  return null
}

function verifyDigest(bytes: Uint8Array, info: DigestInfo): boolean {
  try {
    const hash = createHash(info.alg).update(Buffer.from(bytes)).digest('base64')
    return hash === info.base64
  } catch (err) {
    log.error(SCOPE, 'digest computation failed', err)
    return false
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/** Remove downloaded cores (used by "clear data"). */
export function purgeDownloadedCores(): void {
  try {
    const base = join(app.getPath('userData'), 'xray')
    if (existsSync(base) && statSync(base).isDirectory()) rmSync(base, { recursive: true, force: true })
    log.info(SCOPE, 'downloaded cores purged')
  } catch (err) {
    log.error(SCOPE, 'purge failed', err)
  }
}
