/**
 * Redaction helpers.
 *
 * Every string that leaves the main process (log files, renderer log panel,
 * crash reports, console output) passes through `redact()`. Secrets are
 * registered at runtime as soon as Naxlo learns about them, so a value can
 * never slip into a log *before* it is known.
 */

const REDACTED = '[redacted]'

interface SecretRule {
  needle: string
  replacement: string
}

const rules: SecretRule[] = []
const seen = new Set<string>()

/** Characters that commonly appear in links/keys and must never be logged raw. */
const GENERIC_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // Full URLs that look like subscription endpoints carrying a token path.
  { re: /\b(https?:\/\/)([^\s/@:]+)(:[^\s/@]*)?(@)/gi, replacement: '$1$2$4' },
  // Any bearer/basic authorization header value.
  { re: /(authorization["']?\s*[:=]\s*["']?)([a-z0-9._\-+/=]{6,})/gi, replacement: `$1${REDACTED}` },
  // vless/vmess/trojan/ss links, wherever they show up.
  { re: /\b(?:vless|vmess|trojan|ss|ssh|hy2|hysteria2|wg):\/\/[^\s"'<>]+/gi, replacement: REDACTED },
  // UUID-like tokens.
  {
    re: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    replacement: REDACTED
  },
  // Base64-ish blobs longer than 64 chars (keys, subscription payloads).
  { re: /\b[A-Za-z0-9+/=_.\-]{64,}\b/g, replacement: REDACTED }
]

/** Register a secret so every future log line masks it. */
export function registerSecret(value: string | null | undefined, label = 'secret'): void {
  if (!value || typeof value !== 'string') return
  const trimmed = value.trim()
  if (trimmed.length < 4) return
  if (seen.has(trimmed)) return
  seen.add(trimmed)
  rules.push({ needle: trimmed, replacement: `${REDACTED}:${label}` })
  // Also mask the URL-decoded / decoded variants which Xray likes to print.
  try {
    const decoded = decodeURIComponent(trimmed)
    if (decoded !== trimmed && !seen.has(decoded)) {
      seen.add(decoded)
      rules.push({ needle: decoded, replacement: `${REDACTED}:${label}` })
    }
  } catch {
    /* not a URI component — nothing else to do */
  }
}

export function registerSecrets(values: Array<string | null | undefined>, label = 'secret'): void {
  for (const v of values) registerSecret(v, label)
}

/** Forget every registered secret (used when the vault is wiped). */
export function clearSecrets(): void {
  rules.length = 0
  seen.clear()
}

export function redact(input: unknown): string {
  let text = typeof input === 'string' ? input : safeStringify(input)
  for (const rule of rules) {
    if (!text.includes(rule.needle)) continue
    text = text.split(rule.needle).join(rule.replacement)
  }
  for (const pattern of GENERIC_PATTERNS) {
    text = text.replace(pattern.re, pattern.replacement)
  }
  return text
}

export { maskMiddle, maskUrl, maskAddress } from '../../shared/mask'

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return `${value.name}: ${value.message}`
    if (typeof value === 'string') return value
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
