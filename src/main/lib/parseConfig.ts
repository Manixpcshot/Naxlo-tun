/**
 * Proxy-link parser.
 *
 * Primary target: `vless://` (as requested). `trojan://`, `vmess://` and
 * `ss://` are recognised too so a subscription that mixes protocols does not
 * silently lose entries — unsupported schemes are surfaced in the UI with a
 * reason instead of being dropped.
 */
import { createHash } from 'node:crypto'
import type { NetworkType, Protocol, SecurityType, ServerConfig } from '../../shared/types'

const NETWORK_ALIASES: Record<string, NetworkType> = {
  tcp: 'tcp',
  ws: 'ws',
  websocket: 'ws',
  grpc: 'grpc',
  gun: 'grpc',
  multi: 'grpc',
  h2: 'h2',
  http: 'h2',
  quic: 'quic',
  kcp: 'kcp',
  mkcp: 'kcp',
  splithttp: 'splithttp',
  xhttp: 'xhttp',
  xudp: 'tcp'
}

const SECURITY_ALIASES: Record<string, SecurityType> = {
  none: 'none',
  '': 'none',
  tls: 'tls',
  xtls: 'xtls',
  reality: 'reality',
  recon: 'reality'
}

export interface ParseResult {
  server: ServerConfig
  warnings: string[]
}

export function parseProxyLink(link: string, source: ServerConfig['source'] = 'subscription'): ParseResult | null {
  const raw = link.trim()
  if (!raw) return null
  const schemeEnd = raw.indexOf('://')
  if (schemeEnd < 0) return null
  const scheme = raw.slice(0, schemeEnd).toLowerCase()

  let result: ParseResult | null
  switch (scheme) {
    case 'vless':
      result = parseVless(raw)
      break
    case 'trojan':
      result = parseTrojan(raw)
      break
    case 'vmess':
      result = parseVmess(raw)
      break
    case 'ss':
    case 'shadowsocks':
      result = unsupported('shadowsocks', raw, 'پروتکل Shadowsocks در این نسخه پشتیبانی نمی‌شود')
      break
    default:
      result = unsupported('unknown', raw, `پروتکل «${scheme}» شناخته نشد`)
  }
  if (result) result.server.source = source
  return result
}

function unsupported(protocol: Protocol, raw: string, reason: string): ParseResult {
  return {
    warnings: [reason],
    server: {
      id: fingerprint(protocol, raw),
      name: nameFrom(raw) || 'کانفیگ ناشناخته',
      protocol,
      supported: false,
      unsupportedReason: reason,
      address: '',
      port: 0,
      credential: '',
      security: 'none',
      network: 'unknown',
      addedAt: Date.now(),
      source: 'subscription',
      latencyMs: null,
      latencyAt: null
    }
  }
}

/** vless://<uuid>@<host>:<port>?<query>#<remark> */
function parseVless(raw: string): ParseResult | null {
  const warnings: string[] = []
  const rest = raw.slice('vless://'.length)
  const hashIndex = rest.indexOf('#')
  const withoutFragment = hashIndex >= 0 ? rest.slice(0, hashIndex) : rest
  const fragment = hashIndex >= 0 ? decodeFragment(rest.slice(hashIndex + 1)) : ''

  const atIndex = withoutFragment.lastIndexOf('@')
  if (atIndex < 0) return null
  const credential = withoutFragment.slice(0, atIndex)
  const hostPart = withoutFragment.slice(atIndex + 1)

  const queryIndex = hostPart.indexOf('?')
  const authority = queryIndex >= 0 ? hostPart.slice(0, queryIndex) : hostPart
  const query = queryIndex >= 0 ? hostPart.slice(queryIndex + 1) : ''
  const params = parseQuery(query)

  const { address, port } = splitAuthority(authority)
  if (!address || !port) return null

  const network = (NETWORK_ALIASES[(params.get('type') ?? params.get('network') ?? 'tcp').toLowerCase()] ??
    'tcp') as NetworkType
  const securityRaw = (params.get('security') ?? params.get('tls') ?? 'none').toLowerCase()
  const security = SECURITY_ALIASES[securityRaw] ?? 'none'
  if (securityRaw && !(securityRaw in SECURITY_ALIASES)) {
    warnings.push(`نوع امنیت «${securityRaw}» ناشناخته است و «none» در نظر گرفته شد`)
  }

  const allowInsecure = ['1', 'true', 'yes'].includes((params.get('allowInsecure') ?? '').toLowerCase())
  if (allowInsecure && security === 'tls') {
    warnings.push('allowInsecure فعال است — اعتبار گواهی بررسی نمی‌شود')
  }

  const server: ServerConfig = {
    id: fingerprint('vless', `${address}:${port}:${credential}:${params.toString()}`),
    name: fragment || params.get('remark') || params.get('name') || `${address}:${port}`,
    protocol: 'vless',
    supported: true,
    address,
    port,
    credential,
    flow: params.get('flow') || undefined,
    encryption: params.get('encryption') || 'none',
    security,
    network,
    sni: firstOf(params.get('sni'), params.get('host')) || undefined,
    alpn: splitList(params.get('alpn')),
    fingerprint: params.get('fp') || undefined,
    allowInsecure: allowInsecure || undefined,
    pbk: params.get('pbk') || undefined,
    sid: params.get('sid') || undefined,
    spiderX: params.get('spx') || undefined,
    host: params.get('host') || undefined,
    path: params.get('path') || undefined,
    serviceName: params.get('serviceName') || params.get('serviceName ') || undefined,
    grpcMultiMode: boolParam(params.get('mode'), params.get('multiMode')),
    headerType: params.get('headerType') || params.get('header') || undefined,
    quicSecurity: params.get('quicSecurity') || undefined,
    quicKey: params.get('key') || undefined,
    xhttpMode: params.get('xhttpMode') || params.get('mode') || undefined,
    mux: boolParam(params.get('muxEnabled'), params.get('mux')),
    muxConcurrency: intParam(params.get('muxConcurrency'), params.get('xudpConcurrency')),
    addedAt: Date.now(),
    source: 'subscription',
    latencyMs: null,
    latencyAt: null,
    raw
  }

  validate(server, warnings)
  return { server, warnings }
}

/** trojan://<password>@<host>:<port>?<query>#<remark> */
function parseTrojan(raw: string): ParseResult | null {
  const warnings: string[] = []
  const rest = raw.slice('trojan://'.length)
  const hashIndex = rest.indexOf('#')
  const body = hashIndex >= 0 ? rest.slice(0, hashIndex) : rest
  const fragment = hashIndex >= 0 ? decodeFragment(rest.slice(hashIndex + 1)) : ''
  const atIndex = body.lastIndexOf('@')
  if (atIndex < 0) return null
  const credential = body.slice(0, atIndex)
  const hostPart = body.slice(atIndex + 1)
  const queryIndex = hostPart.indexOf('?')
  const authority = queryIndex >= 0 ? hostPart.slice(0, queryIndex) : hostPart
  const params = parseQuery(queryIndex >= 0 ? hostPart.slice(queryIndex + 1) : '')
  const { address, port } = splitAuthority(authority)
  if (!address || !port) return null

  const network = NETWORK_ALIASES[(params.get('type') ?? params.get('network') ?? 'tcp').toLowerCase()] ?? 'tcp'
  const security = SECURITY_ALIASES[(params.get('security') ?? 'tls').toLowerCase()] ?? 'tls'

  const server: ServerConfig = {
    id: fingerprint('trojan', `${address}:${port}:${credential}`),
    name: fragment || params.get('remark') || `${address}:${port}`,
    protocol: 'trojan',
    supported: true,
    address,
    port,
    credential,
    security,
    network,
    sni: params.get('sni') || params.get('peer') || undefined,
    alpn: splitList(params.get('alpn')),
    fingerprint: params.get('fp') || undefined,
    allowInsecure: ['1', 'true'].includes((params.get('allowInsecure') ?? '').toLowerCase()) || undefined,
    path: params.get('path') || undefined,
    host: params.get('host') || undefined,
    serviceName: params.get('serviceName') || undefined,
    grpcMultiMode: boolParam(params.get('mode'), undefined),
    addedAt: Date.now(),
    source: 'subscription',
    latencyMs: null,
    latencyAt: null,
    raw
  }
  validate(server, warnings)
  return { server, warnings }
}

/** vmess://<base64 json> */
function parseVmess(raw: string): ParseResult | null {
  const warnings: string[] = []
  const body = raw.slice('vmess://'.length).trim()
  let json: string
  try {
    json = Buffer.from(body, 'base64').toString('utf8')
  } catch {
    return null
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
  const address = String(data.add ?? data.addr ?? '')
  const port = Number(data.port ?? 0)
  const credential = String(data.id ?? '')
  if (!address || !port || !credential) return null

  const securityRaw = String(data.tls ?? 'none').toLowerCase()
  const security: SecurityType = securityRaw === 'reality' ? 'reality' : securityRaw === 'tls' ? 'tls' : 'none'
  const network = NETWORK_ALIASES[String(data.net ?? 'tcp').toLowerCase()] ?? 'tcp'

  const server: ServerConfig = {
    id: fingerprint('vmess', `${address}:${port}:${credential}`),
    name: String(data.ps ?? data.remark ?? `${address}:${port}`),
    protocol: 'vmess',
    supported: true,
    address,
    port,
    credential,
    encryption: 'auto',
    security,
    network,
    sni: String(data.sni ?? '') || (security === 'tls' ? address : undefined),
    alpn: splitList(typeof data.alpn === 'string' ? data.alpn : undefined),
    fingerprint: String(data.fp ?? '') || undefined,
    allowInsecure: data.allowInsecure === true || data.allowInsecure === 'true' || undefined,
    pbk: String(data.pbk ?? '') || undefined,
    sid: String(data.sid ?? '') || undefined,
    spiderX: String(data.spx ?? '') || undefined,
    host: String(data.host ?? '') || undefined,
    path: String(data.path ?? '') || undefined,
    serviceName: String(data.path ?? '') && network === 'grpc' ? String(data.path) : undefined,
    headerType: typeof data.type === 'string' ? data.type : undefined,
    addedAt: Date.now(),
    source: 'subscription',
    latencyMs: null,
    latencyAt: null,
    raw
  }
  validate(server, warnings)
  return { server, warnings }
}

function validate(server: ServerConfig, warnings: string[]): void {
  if (server.security === 'reality' && !server.pbk) {
    warnings.push('کلید عمومی REALITY (pbk) در لینک وجود ندارد')
    server.supported = false
    server.unsupportedReason = 'کانفیگ REALITY بدون کلید عمومی کامل نیست'
  }
  if (server.security === 'tls' && !server.sni) {
    server.sni = server.address
    warnings.push('SNI در لینک نبود؛ از آدرس سرور استفاده شد')
  }
  if (server.network === 'ws' && !server.path) server.path = '/'
  if (server.network === 'grpc' && !server.serviceName) {
    warnings.push('serviceName برای gRPC خالی است')
  }
}

function splitAuthority(authority: string): { address: string; port: number } {
  let host = authority
  let port = 443
  // IPv6 literal: [::1]:443
  if (host.startsWith('[')) {
    const close = host.indexOf(']')
    if (close > 0) {
      const literal = host.slice(1, close)
      const tail = host.slice(close + 1)
      const m = /^:(\d+)$/.exec(tail)
      return { address: literal, port: m ? Number(m[1]) : 443 }
    }
  }
  const lastColon = host.lastIndexOf(':')
  if (lastColon > 0) {
    const maybePort = host.slice(lastColon + 1)
    if (/^\d+$/.test(maybePort)) {
      port = Number(maybePort)
      host = host.slice(0, lastColon)
    }
  }
  try {
    host = decodeURIComponent(host)
  } catch {
    /* keep as-is */
  }
  return { address: host, port }
}

function parseQuery(query: string): URLSearchParams {
  try {
    return new URLSearchParams(query)
  } catch {
    return new URLSearchParams()
  }
}

function splitList(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length ? parts : undefined
}

function firstOf(...values: Array<string | null | undefined>): string | undefined {
  for (const v of values) if (v) return v
  return undefined
}

function boolParam(...values: Array<string | null | undefined>): boolean | undefined {
  const v = firstOf(...values)
  if (v === undefined) return undefined
  return ['1', 'true', 'yes', 'multi', 'multiMode', 'gun'].includes(v.toLowerCase())
}

function intParam(...values: Array<string | null | undefined>): number | undefined {
  const v = firstOf(...values)
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

function decodeFragment(fragment: string): string {
  try {
    // Some subscriptions double-encode the remark.
    const once = decodeURIComponent(fragment)
    if (/%[0-9a-fA-F]{2}/.test(once)) return decodeURIComponent(once)
    return once
  } catch {
    return fragment
  }
}

function nameFrom(raw: string): string {
  const hashIndex = raw.indexOf('#')
  return hashIndex >= 0 ? decodeFragment(raw.slice(hashIndex + 1)) : ''
}

function fingerprint(protocol: string, seed: string): string {
  return createHash('sha256').update(`${protocol}|${seed}`).digest('hex').slice(0, 16)
}

/**
 * Split a subscription payload into individual links.
 * Handles: raw text with one link per line, `#` remark lines, and payloads that
 * are themselves base64-encoded (common with TXT subscriptions).
 */
export function extractLinks(text: string): string[] {
  const candidates: string[] = []
  const trimmed = text.trim()
  if (!trimmed) return candidates

  const looksLinkish = /^(vless|vmess|trojan|ss|ssh|hy2|hysteria2|wg|tuic):\/\//im.test(trimmed)
  if (!looksLinkish) {
    const decoded = tryDecodeBase64(trimmed)
    if (decoded) candidates.push(...decoded.split(/\r?\n/))
    else candidates.push(...trimmed.split(/\r?\n/))
  } else {
    candidates.push(...trimmed.split(/\r?\n/))
  }

  const out: string[] = []
  for (const line of candidates) {
    const value = line.trim()
    if (!value || value.startsWith('#') || value.startsWith('//')) continue
    if (!/^(vless|vmess|trojan|ss|ssh|hy2|hysteria2|wg|tuic):\/\//i.test(value)) continue
    out.push(value)
  }
  return out
}

export function tryDecodeBase64(input: string): string | null {
  const compact = input.replace(/\s+/g, '')
  if (compact.length < 16) return null
  if (!/^[A-Za-z0-9+/=_\-]+$/.test(compact)) return null
  try {
    const normalised = compact.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4)
    const buf = Buffer.from(padded, 'base64')
    if (buf.length === 0) return null
    const text = buf.toString('utf8')
    // Reject binary garbage: require mostly printable characters.
    let printable = 0
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 65533)) printable++
    }
    if (printable / Math.max(1, text.length) < 0.95) return null
    if (text.includes('\uFFFD')) return null
    return text
  } catch {
    return null
  }
}
