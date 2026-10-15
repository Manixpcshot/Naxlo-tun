/**
 * Application update check.
 *
 * Naxlo does not auto-update itself (no signed auto-update feed is assumed).
 * It only asks GitHub whether a newer release exists and points the user at it,
 * which keeps the supply chain explicit and auditable.
 */
import { app } from 'electron'
import { log } from './logger'
import type { AppUpdateInfo } from '../../shared/api'

const SCOPE = 'update'
const REPO = 'Manixpcshot/Naxlo-tun'

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export async function checkAppUpdate(): Promise<AppUpdateInfo> {
  const current = app.getVersion()
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `naxlo/${current}` }
    })
    if (!response.ok) {
      log.warn(SCOPE, `update check returned HTTP ${response.status}`)
      return { current, latest: null, updateAvailable: false, releaseUrl: null }
    }
    const data = (await response.json()) as { tag_name?: string; html_url?: string }
    const latest = data.tag_name ? data.tag_name.replace(/^v/, '') : null
    const updateAvailable = Boolean(latest && compareVersions(latest, current) > 0)
    log.info(SCOPE, `update check: current=${current} latest=${latest ?? 'unknown'}`)
    return {
      current,
      latest,
      updateAvailable,
      releaseUrl: updateAvailable ? (data.html_url ?? `https://github.com/${REPO}/releases/latest`) : null
    }
  } catch (err) {
    log.warn(SCOPE, 'update check failed', err)
    return { current, latest: null, updateAvailable: false, releaseUrl: null }
  }
}
