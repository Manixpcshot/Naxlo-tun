/**
 * Geo routing assets (geoip.dat / geosite.dat).
 *
 * Routing rules like `geosite:ir` or `geoip:private` are resolved by Xray at
 * *startup* from these data files. The official Xray zip does not ship them,
 * so without this module a user who enables "Iran direct" or "block ads"
 * gets an opaque "core exited unexpectedly" — the core never even starts.
 * Naxlo therefore downloads the community-maintained data files on demand
 * (first connect that needs them) into a writable assets directory and points
 * XRAY_LOCATION_ASSET at it.
 *
 * Kept free of Electron imports so the smoke tests can bundle it.
 */
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AppError, L } from '../../../shared/i18n'
import type { Settings } from '../../../shared/types'

export const GEOIP_URL = 'https://github.com/v2fly/geoip/releases/latest/download/geoip.dat'
export const GEOSITE_URL = 'https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat'

export const GEO_FILES = ['geoip.dat', 'geosite.dat'] as const

/** True when the active routing settings reference geo data files. */
export function needsGeoAssets(settings: Pick<Settings, 'routeMode' | 'blockAds'>): boolean {
  return settings.blockAds || settings.routeMode === 'iran-direct'
}

function present(dir: string, file: string): boolean {
  try {
    return existsSync(join(dir, file)) && statSync(join(dir, file)).size > 512
  } catch {
    return false
  }
}

/** Prefer geo files shipped next to a custom/bundled core; else our assets dir. */
export function geoAssetLocation(corePath: string, assetsDir: string): string {
  const nextToCore = dirname(corePath)
  if (GEO_FILES.every((file) => present(nextToCore, file))) return nextToCore
  return assetsDir
}

/** Download any missing geo data file into `dir` (atomic replace). */
export async function ensureGeoAssets(
  dir: string,
  timeoutMs = 120_000,
  onProgress?: (file: string, phase: 'download' | 'ready') => void
): Promise<void> {
  mkdirSync(dir, { recursive: true })
  const targets: Array<{ file: (typeof GEO_FILES)[number]; url: string }> = [
    { file: 'geoip.dat', url: GEOIP_URL },
    { file: 'geosite.dat', url: GEOSITE_URL }
  ]
  for (const target of targets) {
    const dest = join(dir, target.file)
    if (present(dir, target.file)) continue
    onProgress?.(target.file, 'download')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(target.url, { redirect: 'follow', signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 1024) throw new Error('payload too small')
      const tmp = `${dest}.tmp`
      writeFileSync(tmp, bytes)
      renameSync(tmp, dest)
      onProgress?.(target.file, 'ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new AppError(
        L(
          `دریافت فایل مسیریابی ${target.file} ناموفق بود (${message})؛ بدون آن قوانین «ایران مستقیم» و «مسدودسازی تبلیغات» کار نمی‌کنند`,
          `Downloading the routing data file ${target.file} failed (${message}); "Iran direct" and "block ads" rules need it`,
          `Yönlendirme veri dosyası ${target.file} indirilemedi (${message}); "İran doğrudan" ve "reklam engelleme" kuralları bu dosyaya ihtiyaç duyar`
        )
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
