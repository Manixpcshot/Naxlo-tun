/**
 * Pure parsers for subscription metadata headers.
 *
 * Kept free of Electron/vault imports so the test runner can exercise them
 * directly (see `scripts/tests/smoke.ts`).
 */
import type { SubUserinfo } from '../../shared/types'

/**
 * Parse the standard `subscription-userinfo` header:
 * `upload=123; download=456; total=7890; expire=1735689600`
 */
export function parseSubscriptionUserinfo(header: string | null): SubUserinfo | null {
  if (!header) return null
  const out: Record<string, number> = {}
  for (const part of header.split(/[;,]/)) {
    const [key, value] = part.split('=').map((piece) => piece.trim())
    if (!key || value === undefined || value === '') continue
    const num = Number(value)
    if (Number.isFinite(num)) out[key.toLowerCase()] = num
  }
  if (!('upload' in out) && !('download' in out) && !('total' in out)) return null
  return {
    upload: Math.max(0, out.upload ?? 0),
    download: Math.max(0, out.download ?? 0),
    total: Math.max(0, out.total ?? 0),
    expire: out.expire ? Math.round(out.expire) : null
  }
}

/**
 * Parse the `profile-title` header. Panels send plain text, url-encoded text
 * or a `base64:` payload — all three are decoded here.
 */
export function parseProfileTitle(header: string | null): string | null {
  if (!header) return null
  let value = header.trim()
  if (!value) return null
  try {
    if (/^base64:/i.test(value)) {
      const decoded = Buffer.from(value.slice(7), 'base64').toString('utf8').trim()
      if (decoded) value = decoded
    } else if (/^text:/i.test(value)) {
      value = value.slice(5)
    }
    const uri = decodeURIComponent(value)
    if (uri) value = uri
  } catch {
    /* keep the raw value */
  }
  value = value.replace(/[\r\n]+/g, ' ').trim()
  return value || null
}
