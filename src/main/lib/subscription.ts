/**
 * Subscription fetching.
 *
 * The URL and the payload are treated as secrets from the moment they enter
 * this module: they are registered with the redactor, kept in the encrypted
 * vault, and only ever surfaced to the UI in masked form.
 */
import { log } from './logger'
import { maskUrl, registerSecret } from './redact'
import { extractLinks, parseProxyLink, tryDecodeBase64 } from './parseConfig'
import { getVault, replaceServers, updateVault } from './secretStore'
import { stableId } from './ids'
import { parseProfileTitle, parseSubscriptionUserinfo } from './submeta'
import { FilePasswordRequired, FilePasswordWrong, fileNameOf, readConfigFile } from './fileImport'
export { parseProfileTitle, parseSubscriptionUserinfo }
import type { ServerConfig, StoredSubscription, SubUserinfo } from '../../shared/types'
import { AppError, L, type LString } from '../../shared/i18n'

const SCOPE = 'subscription'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 naxlo/1.0'

export interface FetchReport {
  ok: boolean
  total: number
  supported: number
  merged: number
  error: string | null
  warnings: string[]
  subscriptionId?: string
  /** Panel-reported title (`profile-title` header), when present. */
  title?: string | null
  userinfo?: SubUserinfo | null
  /** Set when the imported file is an encrypted ZIP and needs a password. */
  needPassword?: boolean
  /** Set when the supplied password failed to decrypt the archive. */
  wrongPassword?: boolean
  /** File-system path for file-based subscriptions (echoed back to the UI). */
  filePath?: string | null
}

/** Stable identifier for a subscription URL (the URL itself stays secret). */
export function subscriptionIdFor(url: string): string {
  return stableId(url)
}

export class SubscriptionError extends AppError {
  constructor(localized: LString, readonly detail?: string) {
    super(localized)
    this.name = 'SubscriptionError'
  }
}

/**
 * Fetch + decode a subscription and refresh the server list.
 * Existing manually-added servers are preserved; subscription entries are
 * replaced wholesale so removed configs disappear.
 */
export async function refreshSubscription(url: string, timeoutMs = 25000): Promise<FetchReport> {
  registerSecret(url, 'subscription')
  const id = subscriptionIdFor(url)
  const warnings: string[] = []
  log.info(SCOPE, `refreshing subscription ${maskUrl(url)}`)

  let text: string
  let userinfo: SubUserinfo | null = null
  let title: string | null = null
  try {
    const fetched = await download(url, timeoutMs)
    text = fetched.text
    userinfo = fetched.userinfo
    title = fetched.title
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(SCOPE, 'subscription download failed', message)
    throw new SubscriptionError(friendlyFetchError(message), message)
  }

  const links = extractLinks(text)
  if (links.length === 0) {
    const hint = text.trim().startsWith('{')
      ? L('پاسخ سرور JSON بود؛ احتمالاً لینک اشتراک اشتباه است', 'The server answered with JSON — the subscription link is probably wrong')
      : L('هیچ کانفیگی در پاسخ پیدا نشد', 'No configs were found in the response')
    throw new SubscriptionError(hint)
  }

  const servers: ServerConfig[] = []
  const seen = new Set<string>()
  for (const link of links) {
    const parsed = parseProxyLink(link)
    if (!parsed) {
      warnings.push('یک لینک قابل تجزیه نبود و نادیده گرفته شد')
      continue
    }
    if (seen.has(parsed.server.id)) continue
    seen.add(parsed.server.id)
    servers.push(parsed.server)
  }

  for (const server of servers) server.subscriptionId = id

  const vault = getVault()
  // Replace only this subscription's servers; other subscriptions and
  // manually imported configs stay untouched.
  const kept = vault.servers.filter((s) => s.subscriptionId !== id)
  // Preserve latency measurements for servers that still exist.
  const previous = new Map(vault.servers.map((s) => [s.id, s]))
  for (const s of servers) {
    const old = previous.get(s.id)
    if (old) {
      s.latencyMs = old.latencyMs
      s.latencyAt = old.latencyAt
    }
  }
  const merged = [...servers, ...kept]
  const supported = merged.filter((s) => s.supported).length

  const existing = vault.subscriptions.find((sub) => sub.id === id)
  const entry: StoredSubscription = {
    id,
    url,
    name: title ?? existing?.name ?? null,
    userinfo,
    updatedAt: Date.now(),
    lastError: null
  }
  const subscriptions = [...vault.subscriptions.filter((sub) => sub.id !== id), entry]

  updateVault({
    subscriptions,
    lastUpdatedAt: Date.now(),
    selectedServerId:
      vault.selectedServerId && merged.some((s) => s.id === vault.selectedServerId)
        ? vault.selectedServerId
        : (merged.find((s) => s.supported)?.id ?? null)
  })
  // `replaceServers` keeps the vault in sync and re-arms redaction.
  replaceServers(merged)

  log.info(SCOPE, `subscription refreshed: ${servers.length} configs (${supported} supported overall)`)
  return {
    ok: true,
    total: merged.length,
    supported,
    merged: servers.length,
    error: null,
    warnings,
    subscriptionId: id,
    title,
    userinfo
  }
}

/**
 * Import (or re-import) a subscription from a local file. Supports plain text,
 * base64 payloads and ZIP archives — including classic password-protected ZIPs.
 * File paths and passwords are treated as secrets (redactor + encrypted vault).
 */
export async function refreshFileSubscription(filePath: string, password?: string | null): Promise<FetchReport> {
  registerSecret(filePath, 'import')
  if (password) registerSecret(password, 'import')
  const id = stableId(`file:${filePath}`)

  let text: string
  try {
    text = await readConfigFile(filePath, password)
  } catch (err) {
    if (err instanceof FilePasswordRequired) {
      return { ok: false, total: 0, supported: 0, merged: 0, error: null, warnings: [], needPassword: true, filePath }
    }
    if (err instanceof FilePasswordWrong) {
      return {
        ok: false,
        total: 0,
        supported: 0,
        merged: 0,
        error: null,
        warnings: [],
        needPassword: true,
        wrongPassword: true,
        filePath
      }
    }
    throw err
  }
  registerSecret(text, 'import')

  const links = extractLinks(text)
  if (links.length === 0) {
    throw new SubscriptionError(L('هیچ کانفیگی در فایل پیدا نشد', 'No configs were found in the file'))
  }

  const warnings: string[] = []
  const servers: ServerConfig[] = []
  const seen = new Set<string>()
  for (const link of links) {
    const parsed = parseProxyLink(link)
    if (!parsed) {
      warnings.push('یک لینک قابل تجزیه نبود و نادیده گرفته شد')
      continue
    }
    if (seen.has(parsed.server.id)) continue
    seen.add(parsed.server.id)
    servers.push(parsed.server)
  }
  for (const server of servers) server.subscriptionId = id

  const vault = getVault()
  const kept = vault.servers.filter((s) => s.subscriptionId !== id)
  const previous = new Map(vault.servers.map((s) => [s.id, s]))
  for (const s of servers) {
    const old = previous.get(s.id)
    if (old) {
      s.latencyMs = old.latencyMs
      s.latencyAt = old.latencyAt
    }
  }
  const merged = [...servers, ...kept]
  const supported = merged.filter((s) => s.supported).length

  const existing = vault.subscriptions.find((sub) => sub.id === id)
  const entry: StoredSubscription = {
    id,
    url: '',
    name: existing?.name ?? fileNameOf(filePath),
    userinfo: null,
    updatedAt: Date.now(),
    lastError: null,
    filePath,
    password: password ?? existing?.password ?? null
  }
  const subscriptions = [...vault.subscriptions.filter((sub) => sub.id !== id), entry]

  updateVault({
    subscriptions,
    lastUpdatedAt: Date.now(),
    selectedServerId:
      vault.selectedServerId && merged.some((s) => s.id === vault.selectedServerId)
        ? vault.selectedServerId
        : (merged.find((s) => s.supported)?.id ?? null)
  })
  replaceServers(merged)

  log.info(SCOPE, `file subscription refreshed: ${servers.length} configs (${supported} supported overall)`)
  return {
    ok: true,
    total: merged.length,
    supported,
    merged: servers.length,
    error: null,
    warnings,
    subscriptionId: id,
    title: entry.name,
    userinfo: null,
    filePath
  }
}

interface DownloadedPayload {
  text: string
  userinfo: SubUserinfo | null
  title: string | null
}

async function download(url: string, timeoutMs: number): Promise<DownloadedPayload> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/plain, application/octet-stream, */*',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.5',
        // Many subscription panels switch output format on this header.
        'profile-update-interval': '0'
      }
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim())
    }
    const contentType = response.headers.get('content-type') ?? ''
    const userinfo = parseSubscriptionUserinfo(response.headers.get('subscription-userinfo'))
    const title = parseProfileTitle(response.headers.get('profile-title'))
    const buf = Buffer.from(await response.arrayBuffer())
    if (buf.length === 0) throw new AppError(L('پاسخ خالی بود', 'The response was empty'))

    // A TXT subscription is usually base64 of the link list. Some panels send
    // the links directly. Try both, preferring the readable interpretation.
    const asText = buf.toString('utf8')
    const wrap = (text: string): DownloadedPayload => ({ text, userinfo, title })
    if (/^(vless|vmess|trojan|ss|hy2|tuic):\/\//im.test(asText.trim())) return wrap(asText)
    const decoded = tryDecodeBase64(asText)
    if (decoded && /^(vless|vmess|trojan|ss|hy2|tuic):\/\//im.test(decoded)) return wrap(decoded)
    if (contentType.includes('json')) return wrap(asText)
    return wrap(decoded ?? asText)
  } finally {
    clearTimeout(timer)
  }
}

function friendlyFetchError(message: string): LString {
  if (/abort/i.test(message)) return L('دریافت اشتراک به دلیل پایان مهلت لغو شد', 'Subscription fetch timed out')
  if (/ENOTFOUND|getaddrinfo/i.test(message)) return L('آدرس اشتراک پیدا نشد (DNS)', 'Subscription host not found (DNS)')
  if (/ECONNREFUSED/i.test(message)) return L('اتصال به سرور اشتراک رد شد', 'Connection to the subscription server was refused')
  if (/HTTP 401|HTTP 403/i.test(message)) return L('سرور اشتراک دسترسی را رد کرد (۴۰۱/۴۰۳)', 'The subscription server denied access (401/403)')
  if (/HTTP 404/i.test(message)) return L('لینک اشتراک یافت نشد (۴۰۴)', 'Subscription link not found (404)')
  if (/HTTP 429/i.test(message)) return L('درخواست‌های بیش از حد؛ کمی بعد دوباره تلاش کنید', 'Too many requests — try again in a moment')
  if (/HTTP 5\d\d/.test(message)) return L('خطای سمت سرور اشتراک', 'Subscription server error (5xx)')
  if (/certificate|SSL|TLS/i.test(message)) return L('خطای گواهی/رمزنگاری در اتصال به سرور اشتراک', 'Certificate/TLS error while contacting the subscription server')
  return L(`دریافت اشتراک ناموفق بود: ${message}`, `Subscription fetch failed: ${message}`)
}

/** Parse a locally supplied payload (file import / paste). */
export function importPayload(text: string): FetchReport {
  const links = extractLinks(text)
  if (!links.length) {
    throw new SubscriptionError(L('هیچ کانفیگ معتبری در متن پیدا نشد', 'No valid config was found in the payload'))
  }
  const servers: ServerConfig[] = []
  const seen = new Set<string>()
  for (const link of links) {
    const parsed = parseProxyLink(link)
    if (!parsed || seen.has(parsed.server.id)) continue
    seen.add(parsed.server.id)
    servers.push({ ...parsed.server, source: 'import', subscriptionId: null })
  }
  const vault = getVault()
  const merged = [...vault.servers.filter((s) => s.id !== undefined && !seen.has(s.id)), ...servers]
  replaceServers(merged)
  log.info(SCOPE, `imported ${servers.length} configs from payload`)
  return {
    ok: true,
    total: merged.length,
    supported: merged.filter((s) => s.supported).length,
    merged: servers.length,
    error: null,
    warnings: []
  }
}
