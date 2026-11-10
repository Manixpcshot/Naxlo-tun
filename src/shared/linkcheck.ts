/**
 * Pure config-link inspector — the shared reference implementation behind the
 * app's Tools page, so validating a link needs no IPC, no file access and no
 * network. It mirrors the rules of `src/main/lib/parseConfig.ts` (which stays
 * authoritative for real connections) and reports them as bilingual messages.
 *
 * Safety: every credential is masked before it leaves this module — a UUID,
 * password or REALITY public key is never returned in full, matching the
 * "never log, never leak" rule of the vault.
 */
import { L, type LString } from './i18n'

export type LinkIssueLevel = 'error' | 'warning'

export interface LinkIssue {
  level: LinkIssueLevel
  text: LString
}

export interface LinkField {
  key: string
  /** Already masked where it carries a secret. */
  value: string
}

export interface LinkInspection {
  /** True when the link parsed and produced no error-level issue. */
  ok: boolean
  protocol: string | null
  fields: LinkField[]
  issues: LinkIssue[]
}

/** Same aliases the main parser accepts, so both surfaces agree. */
export const LINK_NETWORK_ALIASES: Record<string, string> = {
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

export const LINK_SECURITY_ALIASES: Record<string, string> = {
  none: 'none',
  '': 'none',
  tls: 'tls',
  xtls: 'xtls',
  reality: 'reality',
  recon: 'reality'
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Shorten a value for display: everything the user typed is theirs to see, but
 * long credentials are cut in the middle so a full UUID / password / REALITY
 * key is never rendered (and never logged) from the toolbox. Same rule as the
 * website validator, so both surfaces agree.
 */
function display(value: string | null | undefined): string {
  if (!value) return '—'
  const v = String(value)
  return v.length > 12 ? `${v.slice(0, 5)}…${v.slice(-4)}` : v
}

function decodeBase64(input: string): string | null {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return decodeURIComponent(escape(atob(normalized)))
  } catch {
    /* not utf-8 base64 — fall through */
  }
  try {
    return atob(normalized)
  } catch {
    return null
  }
}

/** `host:port` with IPv6 literals in brackets; reports the errors it finds. */
function readAuthority(authority: string, fields: LinkField[], push: (issue: LinkIssue) => void): void {
  let host = authority
  let port = 443
  if (host.startsWith('[')) {
    const close = host.indexOf(']')
    if (close > 0) {
      const literal = host.slice(1, close)
      const rest = host.slice(close + 1)
      port = rest.startsWith(':') ? Number(rest.slice(1)) : port
      host = literal
    }
  } else {
    const colon = host.lastIndexOf(':')
    if (colon > 0) {
      port = Number(host.slice(colon + 1))
      host = host.slice(0, colon)
    }
  }
  fields.push({ key: 'address', value: display(host) })
  fields.push({ key: 'port', value: Number.isFinite(port) ? String(port) : '—' })
  if (!host) {
    push({
      level: 'error',
      text: L('آدرس سرور خالی است', 'The server address is empty', 'Sunucu adresi boş')
    })
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    push({
      level: 'error',
      text: L(`پورت معتبر نیست (${Number.isFinite(port) ? port : '—'})`, `Invalid port (${Number.isFinite(port) ? port : '—'})`, `Geçersiz bağlantı noktası (${Number.isFinite(port) ? port : '—'})`)
    })
  }
}

function readTransport(params: URLSearchParams, fields: LinkField[], push: (issue: LinkIssue) => void, defaultSecurity: string): void {
  const netRaw = (params.get('type') ?? params.get('network') ?? 'tcp').toLowerCase()
  const network = LINK_NETWORK_ALIASES[netRaw]
  if (!network) {
    push({ level: 'error', text: L(`شبکهٔ ناشناخته: ${netRaw}`, `Unknown network: ${netRaw}`, `Bilinmeyen ağ: ${netRaw}`) })
  } else {
    fields.push({ key: 'network', value: network })
  }

  const secRaw = (params.get('security') ?? defaultSecurity).toLowerCase()
  const security = LINK_SECURITY_ALIASES[secRaw]
  if (security === undefined) {
    push({ level: 'warning', text: L(`لایهٔ امنیتی ناشناخته: ${secRaw}`, `Unknown security layer: ${secRaw}`, `Bilinmeyen güvenlik katmanı: ${secRaw}`) })
  } else {
    fields.push({ key: 'security', value: security })
  }

  const sni = params.get('sni') ?? params.get('host') ?? ''
  if (sni) fields.push({ key: 'sni', value: display(sni) })

  if (security === 'reality') {
    const pbk = params.get('pbk') ?? ''
    if (!pbk) {
      push({
        level: 'error',
        text: L(
          'کلید عمومی REALITY (pbk) در لینک نیست — این کانفیگ کار نمی‌کند',
          'The REALITY public key (pbk) is missing — this config cannot work',
          'REALITY genel anahtarı (pbk) yok — bu yapılandırma çalışmaz'
        )
      })
    } else {
      fields.push({ key: 'pbk', value: display(pbk) })
      if (pbk.length < 40) {
        push({
          level: 'warning',
          text: L('کلید عمومی REALITY کوتاه‌تر از حد معمول است', 'The REALITY public key looks shorter than usual', 'REALITY genel anahtarı alışılmadık şekilde kısa')
        })
      }
    }
    if (!sni) {
      push({
        level: 'warning',
        text: L('برای REALITY بهتر است sni هم باشد', 'REALITY usually also carries an sni', 'REALITY için genelde sni de bulunur')
      })
    }
  }

  if (security === 'tls' && !sni) {
    push({
      level: 'warning',
      text: L('sni نبود؛ ناکسو آدرس سرور را جایگزین می‌کند', 'No sni — Naxlo falls back to the server address', 'sni yok — Naxlo sunucu adresini kullanır')
    })
  }

  if (network === 'grpc' && !(params.get('serviceName') ?? '')) {
    push({
      level: 'warning',
      text: L('serviceName برای gRPC خالی است', 'serviceName is empty for gRPC', 'gRPC için serviceName boş')
    })
  }
  if (network === 'grpc' && params.get('serviceName')) {
    fields.push({ key: 'serviceName', value: String(params.get('serviceName')).slice(0, 24) })
  }
  if (network === 'ws' && params.get('path')) {
    fields.push({ key: 'path', value: String(params.get('path')).slice(0, 24) })
  }
  if (params.get('flow')) fields.push({ key: 'flow', value: String(params.get('flow')) })
}

/**
 * Inspect a proxy link without connecting anywhere.
 * Returns masked fields plus error/warning issues in all three languages.
 */
export function inspectLink(raw: string): LinkInspection {
  const issues: LinkIssue[] = []
  const fields: LinkField[] = []
  const push = (issue: LinkIssue): void => {
    issues.push(issue)
  }
  const text = (raw ?? '').trim()
  if (!text) {
    push({ level: 'error', text: L('چیزی وارد نشده است', 'Nothing was entered', 'Hiçbir şey girilmedi') })
    return { ok: false, protocol: null, fields, issues }
  }

  const scheme = text.slice(0, Math.max(0, text.indexOf('://'))).toLowerCase()
  if (!['vless', 'vmess', 'trojan', 'ss'].includes(scheme)) {
    push({
      level: 'error',
      text: L(
        'فرمت لینک ناشناخته است — vless/vmess/trojan/ss پشتیبانی می‌شود',
        'Unknown link format — vless/vmess/trojan/ss are supported',
        'Bilinmeyen bağlantı biçimi — vless/vmess/trojan/ss desteklenir'
      )
    })
    return { ok: false, protocol: scheme || null, fields, issues }
  }
  fields.push({ key: 'protocol', value: scheme === 'ss' ? 'shadowsocks' : scheme })

  const body = text.slice(scheme.length + 3)
  const hash = body.indexOf('#')
  const main = hash >= 0 ? body.slice(0, hash) : body
  if (hash >= 0) {
    let name = body.slice(hash + 1)
    try {
      name = decodeURIComponent(name)
    } catch {
      /* keep the raw fragment */
    }
    name = name.trim()
    if (name) fields.push({ key: 'name', value: name.slice(0, 28) })
  }

  if (scheme === 'vless' || scheme === 'trojan') {
    const at = main.indexOf('@')
    if (at < 0) {
      push({
        level: 'error',
        text: L('بخش اعتبارنامه (@) در لینک نیست', 'The credential (@) section is missing', 'Kimlik bilgisi (@) bölümü eksik')
      })
      return { ok: false, protocol: scheme, fields, issues }
    }
    const credential = main.slice(0, at)
    const rest = main.slice(at + 1)
    if (scheme === 'vless') {
      fields.push({ key: 'uuid', value: display(credential) })
      if (!UUID_RE.test(credential)) {
        push({ level: 'error', text: L('UUID معتبر نیست', 'The UUID is not valid', 'UUID geçerli değil') })
      }
    } else if (!credential) {
      push({ level: 'error', text: L('رمز trojan خالی است', 'The trojan password is empty', 'Trojan parolası boş') })
    } else {
      fields.push({ key: 'password', value: display(credential) })
    }
    const query = rest.indexOf('?')
    const params = new URLSearchParams(query >= 0 ? rest.slice(query + 1) : '')
    readAuthority(query >= 0 ? rest.slice(0, query) : rest, fields, push)
    readTransport(params, fields, push, scheme === 'vless' ? 'none' : 'tls')
    if (scheme === 'vless' && params.get('security') === 'tls' && (params.get('type') ?? 'tcp') === 'tcp' && !params.get('flow')) {
      push({
        level: 'warning',
        text: L(
          'برای VLESS+TLS+TCP معمولاً flow=xtls-rprx-vision لازم است',
          'VLESS+TLS+TCP usually needs flow=xtls-rprx-vision',
          'VLESS+TLS+TCP genelde flow=xtls-rprx-vision gerektirir'
        )
      })
    }
    return { ok: !issues.some((issue) => issue.level === 'error'), protocol: scheme, fields, issues }
  }

  if (scheme === 'vmess') {
    const json = decodeBase64(body)
    if (!json) {
      push({ level: 'error', text: L('Base64 لینک نامعتبر است', 'The link base64 is invalid', 'Bağlantının base64 değeri geçersiz') })
      return { ok: false, protocol: scheme, fields, issues }
    }
    let data: Record<string, unknown>
    try {
      data = JSON.parse(json) as Record<string, unknown>
    } catch {
      push({ level: 'error', text: L('JSON داخل vmess خراب است', 'The JSON inside vmess is corrupt', 'vmess içindeki JSON bozuk') })
      return { ok: false, protocol: scheme, fields, issues }
    }
    const add = String(data.add ?? '')
    if (!add) {
      push({ level: 'error', text: L('آدرس (add) وجود ندارد', 'The address (add) is missing', 'Adres (add) eksik') })
    } else {
      fields.push({ key: 'address', value: display(add) })
    }
    const port = Number(data.port ?? 0)
    fields.push({ key: 'port', value: port ? String(port) : '—' })
    if (!port || port < 1 || port > 65535) {
      push({ level: 'error', text: L('پورت معتبر نیست', 'The port is not valid', 'Bağlantı noktası geçersiz') })
    }
    const id = String(data.id ?? '')
    fields.push({ key: 'uuid', value: display(id) })
    if (!UUID_RE.test(id)) {
      push({ level: 'error', text: L('UUID معتبر نیست', 'The UUID is not valid', 'UUID geçerli değil') })
    }
    const network = LINK_NETWORK_ALIASES[String(data.net ?? 'tcp').toLowerCase()]
    if (!network) {
      push({ level: 'error', text: L(`شبکهٔ ناشناخته: ${String(data.net ?? '')}`, `Unknown network: ${String(data.net ?? '')}`, `Bilinmeyen ağ: ${String(data.net ?? '')}`) })
    } else {
      fields.push({ key: 'network', value: network })
    }
    const security = LINK_SECURITY_ALIASES[String(data.tls ?? 'none').toLowerCase()] ?? 'none'
    fields.push({ key: 'security', value: security })
    if (security === 'tls' && !data.sni && !data.host) {
      push({
        level: 'warning',
        text: L('sni نبود؛ ناکسو آدرس سرور را جایگزین می‌کند', 'No sni — Naxlo falls back to the server address', 'sni yok — Naxlo sunucu adresini kullanır')
      })
    }
    if (data.ps) fields.push({ key: 'name', value: String(data.ps).slice(0, 28) })
    return { ok: !issues.some((issue) => issue.level === 'error'), protocol: scheme, fields, issues }
  }

  // shadowsocks: ss://[userinfo@]host:port#name, userinfo may be base64
  let authority = main
  let userinfo: string | null = null
  const at = main.lastIndexOf('@')
  if (at > 0) {
    userinfo = decodeBase64(main.slice(0, at)) ?? main.slice(0, at)
    authority = main.slice(at + 1)
  } else {
    const decoded = decodeBase64(main)
    if (decoded && decoded.includes('@')) {
      const split = decoded.lastIndexOf('@')
      userinfo = decoded.slice(0, split)
      authority = decoded.slice(split + 1)
    }
  }
  if (userinfo && userinfo.includes(':')) {
    fields.push({ key: 'method', value: userinfo.slice(0, userinfo.indexOf(':')) })
  } else {
    push({
      level: 'warning',
      text: L('بخش method:password خوانده نشد', 'The method:password part could not be read', 'method:password bölümü okunamadı')
    })
  }
  readAuthority(authority, fields, push)
  return { ok: !issues.some((issue) => issue.level === 'error'), protocol: scheme, fields, issues }
}
