/**
 * Naxlo smoke tests.
 *
 * These run without Electron: the parser and the Xray config builder are pure
 * modules, so a plain Node runner is enough to catch regressions in the two
 * pieces that matter most (link parsing + generated outbound config).
 *
 * Run with: `npm test` (see scripts/run-tests.mjs).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractLinks, parseProxyLink, tryDecodeBase64 } from '../../src/main/lib/parseConfig'
import { buildXrayConfig, validateConfig } from '../../src/main/lib/xray/config'
import { pickSizeMb, steadyMbps, tele2SizeMb, SPEED_LADDER_MB } from '../../src/shared/speed'
import { fa, minutesLabel, setFormatLocale } from '../../src/renderer/src/lib/format'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import { maskAddress, maskIp, maskMiddle, maskUrl } from '../../src/shared/mask'
import { redact, registerSecret } from '../../src/main/lib/redact'
import { parseProfileTitle, parseSubscriptionUserinfo } from '../../src/main/lib/submeta'
import {
  crc32Buf,
  decodeSubscriptionBytes,
  extractFromZip,
  fileNameOf,
  isZipBuffer,
  zipCryptoEncrypt,
  zipNeedsPassword,
  zipUsesAes
} from '../../src/main/lib/fileImport'
import { WINTUN_VERSION, WINTUN_ZIP_SHA256, WINTUN_ZIP_URL } from '../../src/main/lib/xray/wintun'
import { GEO_FILES, GEOIP_URL, GEOSITE_URL, geoAssetLocation, needsGeoAssets } from '../../src/main/lib/xray/geo'
import { strToU8, zipSync } from 'fflate'
import { pickBestServer } from '../../src/main/lib/autoselect'
import { inspectLink, LINK_NETWORK_ALIASES, LINK_SECURITY_ALIASES } from '../../src/shared/linkcheck'
import { aggregateStats, summarizeToday } from '../../src/shared/stats'
import type { SessionStat, SpeedSample } from '../../src/shared/types'
import type { ServerConfig } from '../../src/shared/types'

let passed = 0
const failures: string[] = []

function test(name: string, fn: () => void): void {
  try {
    fn()
    passed++
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`)
  }
}

/* ---------------------------------------------------------------- parsing */

const VLESS_TLS_WS =
  'vless://1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d@example.server.com:443?encryption=none&security=tls&type=ws&host=cdn.example.com&path=%2Fws&fp=chrome&sni=cdn.example.com&alpn=h2,http%2F1.1#%D8%B3%D8%B1%D9%88%D8%B1%20%D8%A7%D9%88%D9%84'

const VLESS_REALITY =
  'vless://aaaa1111-2222-3333-4444-555566667777@1.2.3.4:2053?security=reality&type=tcp&pbk=SbVKOEMjK0sIlbwg4TIBgHoBac6VblXYYz1n6UZ8XgU&sid=6ba85179&fp=chrome&sni=www.microsoft.com&spx=%2F&sni2=&flow=xtls-rprx-vision#Reality-TE'

test('file import: decodes raw link lists and base64 payloads', () => {
  const raw = 'vless://abc@1.2.3.4:443?security=reality#DE\ntrojan://pw@5.6.7.8:443'
  assert.equal(decodeSubscriptionBytes(Buffer.from(raw, 'utf8')), raw)
  const b64 = Buffer.from(raw, 'utf8').toString('base64')
  assert.equal(decodeSubscriptionBytes(Buffer.from(b64, 'utf8')), raw)
})

test('file import: zip detection helpers', () => {
  const text = Buffer.from('hello', 'utf8')
  assert.equal(isZipBuffer(text), false)
  assert.equal(zipNeedsPassword(text), false)
  const local = Buffer.from([0x50, 0x4b, 0x03, 0x04])
  assert.equal(isZipBuffer(local), true)
  const central = Buffer.alloc(50)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(0x0001, 8) // general purpose flag: encrypted
  central.writeUInt16LE(0, 10) // method: deflate
  assert.equal(zipNeedsPassword(Buffer.concat([local, central])), true)
  const aes = Buffer.alloc(50)
  aes.writeUInt32LE(0x02014b50, 0)
  aes.writeUInt16LE(0x0001, 8)
  aes.writeUInt16LE(99, 10) // method 99 = WinZip AES
  assert.equal(zipUsesAes(Buffer.concat([local, aes])), true)
})

test('file import: extracts text from a plain zip', () => {
  const raw = 'vless://abc@1.2.3.4:443#DE'
  const zip = Buffer.from(zipSync({ 'configs.txt': strToU8(raw) }))
  assert.equal(isZipBuffer(zip), true)
  assert.equal(zipNeedsPassword(zip), false)
  const out = extractFromZip(zip)
  assert.equal(out.data.toString('utf8'), raw)
})

test('file import: decrypts a ZipCrypto password-protected zip', () => {
  const content = Buffer.from('trojan://pw@9.9.9.9:443#TR', 'utf8')
  const password = 'naxlo-test'
  const crc = crc32Buf(content)
  const enc = zipCryptoEncrypt(content, password, (crc >>> 24) & 0xff)
  const name = Buffer.from('subs.txt', 'utf8')

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(1, 6) // encrypted flag
  local.writeUInt16LE(0, 8) // method: stored
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(enc.length, 18)
  local.writeUInt32LE(content.length, 22)
  local.writeUInt16LE(name.length, 26)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(1, 8)
  central.writeUInt16LE(0, 10)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(enc.length, 20)
  central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(name.length, 28)

  const localSize = 30 + name.length + enc.length
  const centralSize = 46 + name.length
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(localSize, 16)

  const zip = Buffer.concat([local, name, enc, central, name, eocd])
  assert.equal(zipNeedsPassword(zip), true)
  assert.throws(() => extractFromZip(zip), (e: unknown) => (e as Error).name === 'FilePasswordRequired')
  const out = extractFromZip(zip, password)
  assert.equal(out.data.toString('utf8'), content.toString('utf8'))
  assert.throws(() => extractFromZip(zip, 'wrong-pass'), (e: unknown) => (e as Error).name === 'FilePasswordWrong')
})

test('file import: file name extraction handles windows paths', () => {
  assert.equal(fileNameOf('C:\\Users\\x\\configs.txt'), 'configs.txt')
  assert.equal(fileNameOf('/home/x/subs/my-file.zip'), 'my-file.zip')
})

test('parses a VLESS + TLS + WebSocket link', () => {
  const parsed = parseProxyLink(VLESS_TLS_WS)
  assert.ok(parsed, 'link should parse')
  const s = parsed.server
  assert.equal(s.protocol, 'vless')
  assert.equal(s.supported, true)
  assert.equal(s.address, 'example.server.com')
  assert.equal(s.port, 443)
  assert.equal(s.credential, '1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d')
  assert.equal(s.network, 'ws')
  assert.equal(s.security, 'tls')
  assert.equal(s.path, '/ws')
  assert.equal(s.host, 'cdn.example.com')
  assert.equal(s.sni, 'cdn.example.com')
  assert.deepEqual(s.alpn, ['h2', 'http/1.1'])
  assert.equal(s.name, 'سرور اول')
  assert.equal(s.encryption, 'none')
})

test('parses a VLESS + REALITY + xtls-rprx-vision link', () => {
  const parsed = parseProxyLink(VLESS_REALITY)
  assert.ok(parsed)
  const s = parsed.server
  assert.equal(s.security, 'reality')
  assert.equal(s.flow, 'xtls-rprx-vision')
  assert.equal(s.pbk, 'SbVKOEMjK0sIlbwg4TIBgHoBac6VblXYYz1n6UZ8XgU')
  assert.equal(s.sid, '6ba85179')
  assert.equal(s.spiderX, '/')
  assert.equal(s.sni, 'www.microsoft.com')
  assert.equal(s.port, 2053)
  assert.equal(validateConfig(s), null)
})

test('persian remark survives double encoding', () => {
  const parsed = parseProxyLink(VLESS_REALITY)
  assert.ok(parsed)
  assert.equal(parsed.server.name, 'Reality-TE')
})

test('trojan links are parsed and marked supported', () => {
  const parsed = parseProxyLink('trojan://p@ssw0rd@trojan.example.com:443?sni=trojan.example.com&type=tcp#Trojan')
  assert.ok(parsed)
  assert.equal(parsed.server.protocol, 'trojan')
  assert.equal(parsed.server.credential, 'p@ssw0rd')
  assert.equal(parsed.server.security, 'tls')
  assert.equal(parsed.server.name, 'Trojan')
})

test('vmess links are decoded from base64 JSON', () => {
  const payload = {
    v: '2',
    ps: 'VMess TE',
    add: 'vmess.example.com',
    port: '443',
    id: '2222-3333-4444',
    aid: '0',
    net: 'ws',
    tls: 'tls',
    host: 'cdn.example.com',
    path: '/vmess',
    sni: 'cdn.example.com'
  }
  const link = `vmess://${Buffer.from(JSON.stringify(payload)).toString('base64')}`
  const parsed = parseProxyLink(link)
  assert.ok(parsed)
  assert.equal(parsed.server.protocol, 'vmess')
  assert.equal(parsed.server.address, 'vmess.example.com')
  assert.equal(parsed.server.port, 443)
  assert.equal(parsed.server.network, 'ws')
  assert.equal(parsed.server.name, 'VMess TE')
})

test('unknown schemes are surfaced, not dropped', () => {
  const parsed = parseProxyLink('tuic://something@host:443#tuic')
  assert.ok(parsed)
  assert.equal(parsed.server.supported, false)
  assert.ok(parsed.server.unsupportedReason)
})

test('REALITY without a public key is rejected with a reason', () => {
  const parsed = parseProxyLink('vless://aaaa1111-2222-3333-4444-555566667777@1.2.3.4:443?security=reality&type=tcp#bad')
  assert.ok(parsed)
  assert.equal(parsed.server.supported, false)
})

test('extractLinks handles base64 payloads and remark lines', () => {
  const payload = ['# subscription', VLESS_TLS_WS, '', VLESS_REALITY].join('\n')
  const encoded = Buffer.from(payload, 'utf8').toString('base64')
  const links = extractLinks(encoded)
  assert.equal(links.length, 2)
  assert.equal(extractLinks(payload).length, 2)
})

test('tryDecodeBase64 rejects binary garbage', () => {
  assert.equal(tryDecodeBase64(Buffer.from([0, 1, 2, 3, 255, 254]).toString('base64')), null)
  const repeated = Buffer.from('vless://x'.repeat(8), 'utf8').toString('base64')
  assert.equal(tryDecodeBase64(repeated)?.startsWith('vless://'), true)
})

/* ------------------------------------------------------------ xray config */

test('builds a valid VLESS outbound with local inbounds only', () => {
  const parsed = parseProxyLink(VLESS_TLS_WS)
  assert.ok(parsed)
  const config = buildXrayConfig({ server: parsed.server, settings: DEFAULT_SETTINGS })
  const inbounds = config.inbounds as any[]
  assert.equal(inbounds.length, 2)
  assert.equal(inbounds[0].protocol, 'socks')
  assert.equal(inbounds[0].listen, '127.0.0.1')
  assert.equal(inbounds[1].protocol, 'http')
  const outbounds = config.outbounds as any[]
  assert.equal(outbounds[0].protocol, 'vless')
  assert.equal(outbounds[0].settings.vnext[0].address, 'example.server.com')
  assert.equal(outbounds[0].streamSettings.network, 'ws')
  assert.equal(outbounds[0].streamSettings.tlsSettings.serverName, 'cdn.example.com')
  assert.equal(outbounds[1].protocol, 'freedom')
  assert.equal(outbounds[2].protocol, 'blackhole')
  // Proxy mode stays driver-free: no tun inbound anywhere in the config.
  assert.equal(JSON.stringify(config).includes('tun'), false)
})

test('xray config: TUN mode adds the built-in tun inbound', () => {
  const parsed = parseProxyLink(VLESS_TLS_WS)
  assert.ok(parsed)
  const config = buildXrayConfig({ server: parsed.server, settings: { ...DEFAULT_SETTINGS, connectionMode: 'tun' } })
  const inbounds = config.inbounds as any[]
  const tun = inbounds.find((i) => i.protocol === 'tun')
  assert.ok(tun)
  assert.deepEqual(tun.settings.autoSystemRoutingTable, ['0.0.0.0/0'])
  assert.equal(tun.settings.autoOutboundsInterface, 'auto')
  assert.equal(tun.settings.gateway[0], '10.213.0.1/24')
  assert.ok(Array.isArray(tun.settings.dns) && tun.settings.dns.length > 0)
  // Local SOCKS/HTTP inbounds remain available for direct clients.
  assert.ok(inbounds.some((i) => i.protocol === 'socks'))
  assert.ok(inbounds.some((i) => i.protocol === 'http'))
  // In-TUN DNS: a `dns` outbound answers wire queries from the adapter and
  // the port-53 rule routes them to it before any other rule can.
  const outbounds = config.outbounds as any[]
  const dnsOut = outbounds.find((o) => o.protocol === 'dns')
  assert.ok(dnsOut)
  assert.equal(dnsOut.tag, 'naxlo-dns')
  const dnsSection = config.dns as any
  assert.ok(dnsSection)
  assert.equal(dnsSection.queryStrategy, 'UseIPv4')
  assert.ok(dnsSection.servers.some((s: string) => s.startsWith('https://')))
  const rules = (config.routing as any).rules as any[]
  const dnsRule = rules.find((r) => r.outboundTag === 'naxlo-dns')
  assert.ok(dnsRule)
  assert.deepEqual(dnsRule.inboundTag, ['naxlo-tun'])
  assert.equal(rules[0], dnsRule)
})

test('format: digits and units follow the active language', () => {
  setFormatLocale('en')
  assert.equal(fa(1234567), '1,234,567')
  assert.equal(minutesLabel(62), '1h 2m')
  assert.equal(minutesLabel(90), '1h 30m')
  setFormatLocale('fa')
  assert.equal(fa(1234567), '۱٬۲۳۴٬۵۶۷')
  assert.equal(minutesLabel(62), '۱ ساعت و ۲ دقیقه')
  assert.equal(minutesLabel(60), '۱ ساعت')
  setFormatLocale('tr')
  assert.equal(minutesLabel(62), '1 sa 2 dk')
  setFormatLocale('en')
})

test('speed: ladder size follows the probe rate', () => {
  assert.equal(pickSizeMb(1), 8)
  assert.equal(pickSizeMb(10), 16)
  assert.equal(pickSizeMb(40), 64)
  assert.equal(pickSizeMb(500), 100)
  assert.equal(pickSizeMb(0), SPEED_LADDER_MB[0])
  assert.equal(pickSizeMb(Number.NaN), SPEED_LADDER_MB[0])
})

test('speed: steady rate excludes the slow-start ramp', () => {
  // 8 s window with a 1.5 s ramp: 80 MiB total, 10 MiB inside the ramp.
  const mbps = steadyMbps(80 * 1024 * 1024, 10 * 1024 * 1024, 8000)
  assert.ok(Math.abs(mbps - 90.3) < 0.5, `mbps=${mbps}`)
  // A window shorter than the ramp never divides by <=0.
  assert.ok(steadyMbps(1000, 500, 100) >= 0)
})

test('speed: tele2 mirror picks the largest fitting file', () => {
  assert.equal(tele2SizeMb(8), 10)
  assert.equal(tele2SizeMb(16), 10)
  assert.equal(tele2SizeMb(32), 20)
  assert.equal(tele2SizeMb(64), 50)
  assert.equal(tele2SizeMb(100), 100)
})

test('xray config: proxy mode has no dns outbound or section', () => {
  const parsed = parseProxyLink(VLESS_TLS_WS)
  assert.ok(parsed)
  const config = buildXrayConfig({ server: parsed.server, settings: DEFAULT_SETTINGS })
  const outbounds = config.outbounds as any[]
  assert.ok(!outbounds.some((o) => o.protocol === 'dns'))
  assert.equal(config.dns, undefined)
  const rules = (config.routing as any).rules as any[]
  assert.ok(!rules.some((r) => r.outboundTag === 'naxlo-dns'))
})

test('geo: routing settings decide whether geo assets are needed', () => {
  assert.equal(needsGeoAssets({ routeMode: 'all-proxy', blockAds: false }), false)
  assert.equal(needsGeoAssets({ routeMode: 'iran-direct', blockAds: false }), true)
  assert.equal(needsGeoAssets({ routeMode: 'all-proxy', blockAds: true }), true)
  assert.ok(GEOIP_URL.endsWith('/geoip.dat'))
  assert.ok(GEOSITE_URL.endsWith('/dlc.dat'))
  assert.deepEqual([...GEO_FILES], ['geoip.dat', 'geosite.dat'])
})

test('geo: asset location prefers a core dir that already ships them', () => {
  const os = require('node:os') as typeof import('node:os')
  const fs = require('node:fs') as typeof import('node:fs')
  const dir = fs.mkdtempSync(require('node:path').join(os.tmpdir(), 'naxlo-geo-'))
  const coreDir = require('node:path').join(dir, 'core')
  const assets = require('node:path').join(dir, 'assets')
  fs.mkdirSync(coreDir, { recursive: true })
  assert.equal(geoAssetLocation(require('node:path').join(coreDir, 'xray.exe'), assets), assets)
  for (const file of GEO_FILES) fs.writeFileSync(require('node:path').join(coreDir, file), 'x'.repeat(1024))
  assert.equal(geoAssetLocation(require('node:path').join(coreDir, 'xray.exe'), assets), coreDir)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('wintun: pinned official checksum and URL', () => {
  assert.match(WINTUN_ZIP_SHA256, /^[0-9a-f]{64}$/)
  assert.equal(WINTUN_ZIP_URL, `https://www.wintun.net/builds/wintun-${WINTUN_VERSION}.zip`)
})

test('REALITY stream settings carry publicKey, shortId and spiderX', () => {
  const parsed = parseProxyLink(VLESS_REALITY)
  assert.ok(parsed)
  const config = buildXrayConfig({ server: parsed.server, settings: DEFAULT_SETTINGS })
  const reality = (config.outbounds as any[])[0].streamSettings.realitySettings
  assert.equal(reality.publicKey, 'SbVKOEMjK0sIlbwg4TIBgHoBac6VblXYYz1n6UZ8XgU')
  assert.equal(reality.shortId, '6ba85179')
  assert.equal(reality.spiderX, '/')
  assert.equal((config.outbounds as any[])[0].settings.vnext[0].users[0].flow, 'xtls-rprx-vision')
})

test('iran-direct routing adds geosite/geoip rules', () => {
  const parsed = parseProxyLink(VLESS_TLS_WS)
  assert.ok(parsed)
  const config = buildXrayConfig({
    server: parsed.server,
    settings: { ...DEFAULT_SETTINGS, routeMode: 'iran-direct', blockAds: true }
  })
  const rules = (config.routing as any).rules as any[]
  assert.ok(rules.some((r) => r.outboundTag === 'naxlo-block'))
  assert.ok(rules.some((r) => Array.isArray(r.domain) && r.domain.includes('geosite:ir')))
  assert.equal(rules[rules.length - 1].outboundTag, 'naxlo-proxy')
})

/* ------------------------------------------------------------- redaction */

test('redactor masks registered secrets and known patterns', () => {
  registerSecret('super-secret-token-123456', 'test')
  const line = 'GET /super-secret-token-123456 HTTP/1.1'
  assert.equal(redact(line).includes('super-secret-token-123456'), false)
  const vlessLine = `dialing to ${VLESS_TLS_WS}`
  assert.equal(redact(vlessLine).includes('1b6e8c2a'), false)
  const uuidLine = 'user 1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d failed'
  assert.equal(redact(uuidLine).includes('1b6e8c2a'), false)
})

test('masking helpers keep values unrecognisable but distinguishable', () => {
  assert.equal(maskAddress('185.120.33.44'), '185.120.••.••')
  assert.equal(maskIp('203.0.113.9'), '203.0.••.••')
  assert.equal(maskMiddle('abcdefghij', 2, 2).startsWith('ab'), true)
  assert.equal(maskUrl('https://panel.example.com/sub/abcdef123456').includes('abcdef123456'), false)
})

/* ------------------------------------------------- subscription metadata */

test('parses the subscription-userinfo quota header', () => {
  const info = parseSubscriptionUserinfo(
    'upload=1073741824; download=2147483648; total=10737418240; expire=1767225600'
  )
  assert.ok(info)
  assert.equal(info.upload, 1073741824)
  assert.equal(info.download, 2147483648)
  assert.equal(info.total, 10737418240)
  assert.equal(info.expire, 1767225600)
  assert.equal(parseSubscriptionUserinfo(null), null)
  assert.equal(parseSubscriptionUserinfo('garbage'), null)
  const unlimited = parseSubscriptionUserinfo('upload=0; download=0; total=0')
  assert.ok(unlimited && unlimited.total === 0 && unlimited.expire === null)
})

test('parses the profile-title header (plain + base64)', () => {
  assert.equal(parseProfileTitle('base64:' + Buffer.from('اشتراک من').toString('base64')), 'اشتراک من')
  assert.equal(parseProfileTitle('My Plan'), 'My Plan')
  assert.equal(parseProfileTitle('   '), null)
  assert.equal(parseProfileTitle(null), null)
})

/* ---------------------------------------------------- smart server pick */

function fakeServer(patch: Partial<ServerConfig>): ServerConfig {
  return {
    id: patch.id ?? 'x',
    name: patch.name ?? 'server',
    protocol: 'vless',
    supported: true,
    address: '1.1.1.1',
    port: 443,
    credential: 'uuid',
    security: 'none',
    network: 'tcp',
    addedAt: 1,
    source: 'subscription',
    subscriptionId: null,
    latencyMs: null,
    latencyAt: null,
    ...patch
  }
}

test('auto pick prefers the fastest healthy server and honours exclusions', () => {
  const slow = fakeServer({ id: 'slow', latencyMs: 400 })
  const fast = fakeServer({ id: 'fast', latencyMs: 80 })
  const untested = fakeServer({ id: 'untested', addedAt: 5 })
  const broken = fakeServer({ id: 'broken', supported: false, latencyMs: 10 })
  const pool = [slow, fast, untested, broken]
  assert.equal(pickBestServer(pool)?.id, 'fast')
  assert.equal(pickBestServer(pool, ['fast'])?.id, 'slow')
  assert.equal(pickBestServer([untested, broken])?.id, 'untested')
  assert.equal(pickBestServer([broken]), null)
  assert.equal(pickBestServer([]), null)
})

/* ------------------------------------------------------- renderer styling */
/*
 * v1.1.0 shipped with a missing semicolon after an `@import` in global.css.
 * CSS parsed the two import lines as one broken at-rule and silently dropped
 * components.css from the bundle — the whole layout vanished. These guards
 * make that class of mistake fail the test suite instead of shipping.
 */

const stylePath = (file: string): string => resolve(process.cwd(), 'src/renderer/src/styles', file)

test('every @import in global.css is terminated with a semicolon', () => {
  const css = readFileSync(stylePath('global.css'), 'utf8')
  const imports = css.split('\n').filter((line) => line.trim().startsWith('@import'))
  assert.ok(imports.length >= 4, 'global.css should import the style layers')
  for (const line of imports) {
    assert.ok(line.trim().endsWith(';'), `unterminated import: ${line}`)
  }
  assert.ok(css.includes('components.css'), 'layout layer must stay imported')
})

test('flag stylesheet selectors match the Flag component contract', () => {
  const css = readFileSync(stylePath('flags.css'), 'utf8')
  const component = readFileSync(
    resolve(process.cwd(), 'src/renderer/src/components/Flag.tsx'),
    'utf8'
  )
  assert.ok(component.includes('data-flag='), 'Flag renders a data-flag attribute')
  assert.ok(css.includes('[data-flag="'), 'flags.css must target [data-flag="xx"]')
  assert.ok(!/^\.flag-[a-z]{2}\{/m.test(css), 'class-based flag selectors are dead code')
})

/* ------------------------------------------------------------------ stats */

test('stats: aggregation splits midnight-spanning sessions and ignores open ones', () => {
  const { aggregateStats, dayKey, formatMinutes } = require('../../src/shared/stats') as typeof import('../../src/shared/stats')
  const DAY = 86400000
  const now = Date.now()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const t0 = today.getTime()
  const sessions = [
    {
      serverId: 'srv-a', serverName: '🇩🇪 DE-1', country: null, mode: 'proxy' as const,
      startedAt: t0 - 2 * DAY + 10 * 3600000, endedAt: t0 - 2 * DAY + 10 * 3600000 + 90 * 60000, reason: 'user'
    },
    {
      serverId: 'srv-a', serverName: '🇩🇪 DE-1', country: null, mode: 'proxy' as const,
      startedAt: t0 - 3 * 3600000, endedAt: t0 + 2 * 3600000, reason: 'user'
    },
    {
      serverId: 'srv-b', serverName: '🇫🇷 FR-9', country: null, mode: 'proxy' as const,
      startedAt: now, endedAt: 0, reason: ''
    }
  ]
  const summary = aggregateStats(sessions, 14, now)
  assert.equal(summary.totalSessions, 2, 'the open session must be ignored')
  assert.equal(summary.totalMinutes, 390)
  assert.equal(summary.avgMinutes, 195)
  assert.equal(summary.daily.length, 14)
  const byKey = new Map(summary.daily.map((d: { date: string; minutes: number }) => [d.date, d.minutes]))
  assert.equal(byKey.get(dayKey(t0 - 2 * DAY)), 90)
  assert.equal(byKey.get(dayKey(t0 - DAY)), 180, 'three hours before midnight land on the previous day')
  assert.equal(byKey.get(dayKey(t0)), 120)
  assert.equal(summary.topServers.length, 1)
  assert.equal(summary.topServers[0].serverId, 'srv-a')
  assert.equal(summary.topServers[0].sessions, 2)
  assert.equal(formatMinutes(135), '2h 15m')
  assert.equal(formatMinutes(60), '1h')
  assert.equal(formatMinutes(45), '45m')
})

test('stats: daily buckets are consecutive calendar days (DST-safe)', () => {
  const { aggregateStats } = require('../../src/shared/stats') as typeof import('../../src/shared/stats')
  for (const now of [Date.now(), new Date('2026-11-06T12:00:00').getTime(), new Date('2026-03-29T12:00:00').getTime()]) {
    const summary = aggregateStats([], 30, now)
    assert.equal(summary.daily.length, 30)
    const keys = new Set(summary.daily.map((d) => d.date))
    assert.equal(keys.size, 30, 'a DST switch must not duplicate or skip a local date')
    for (let i = 1; i < summary.daily.length; i++) {
      const prev = summary.daily[i - 1].date
      const next = new Date(`${prev}T12:00:00`)
      next.setDate(next.getDate() + 1)
      const expected = `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, '0')}-${`${next.getDate()}`.padStart(2, '0')}`
      assert.equal(summary.daily[i].date, expected, `bucket ${i} must be the next calendar day`)
    }
  }
})

test('stats: open heartbeating sessions are ignored, stale ones keep their time', () => {
  const { aggregateStats } = require('../../src/shared/stats') as typeof import('../../src/shared/stats')
  const now = Date.now()
  const sessions = [
    {
      // Still running: heartbeats pushed endedAt forward but reason is empty.
      serverId: 'open', serverName: 'OPEN', country: null, mode: 'proxy' as const,
      startedAt: now - 3600000, endedAt: now - 60000, reason: ''
    },
    {
      // Crashed mid-session; startup closed it as stale at the last heartbeat.
      serverId: 'crashed', serverName: 'CRASHED', country: null, mode: 'proxy' as const,
      startedAt: now - 7200000, endedAt: now - 5400000, reason: 'stale'
    }
  ]
  const summary = aggregateStats(sessions, 14, now)
  assert.equal(summary.totalSessions, 1, 'the open session must not be counted')
  assert.equal(summary.totalMinutes, 30, 'the crashed session keeps its heartbeat duration')
  assert.equal(summary.topServers[0].serverId, 'crashed')
})

test('stats: speed samples are trimmed to the newest window', () => {
  const { trimSpeedSamples } = require('../../src/shared/stats') as typeof import('../../src/shared/stats')
  const samples = Array.from({ length: 130 }, (_, i) => ({ at: i + 1, mbps: i, ms: 10 }))
  const trimmed = trimSpeedSamples(samples, 120)
  assert.equal(trimmed.length, 120)
  assert.equal(trimmed[0].at, 11)
  assert.equal(trimmed[119].at, 130)
})

/* ------------------------------------------------------- turkish coverage */

test('every static main-process L() string has a Turkish translation', () => {
  const { TR_MAIN } = require('../../src/shared/i18n-tr-main') as typeof import('../../src/shared/i18n-tr-main')
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith('.ts')) files.push(full)
    }
  }
  walk(resolve(process.cwd(), 'src/main'))
  const missing: string[] = []
  let checked = 0
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    // L('fa', 'en') or L("fa", "en") with optional explicit third argument.
    const pattern = /(?<![\w.])L\(\s*('([^'\\]|\\.)*'|"([^"\\]|\\.)*")\s*,\s*('([^'\\]|\\.)*'|"([^"\\]|\\.)*")\s*(,)?/g
    for (const match of src.matchAll(pattern)) {
      const enRaw = (match[4] ?? match[5] ?? '').trim()
      const quote = enRaw[0]
      const en = enRaw.slice(1, -1).replace(/\\(['"])/g, '$1')
      if (quote === '`') continue
      checked++
      const hasThird = Boolean(match[6])
      if (!hasThird && !(en in TR_MAIN)) missing.push(`${file}: ${en}`)
    }
  }
  assert.ok(checked >= 70, `expected to scan most L() calls, saw ${checked}`)
  assert.deepEqual(missing, [], 'strings without Turkish coverage')
})

/* ------------------------------------------------------- config inspector */

test('inspectLink accepts a valid vless reality link', () => {
  const link =
    'vless://11111111-2222-3333-4444-555555555555@1.2.3.4:443?encryption=none&security=reality&pbk=Zk3nQ7vT1mXp9wLcRbYdFgHsJaKeMiNoPqRsTuVwXyZ&sni=www.microsoft.com&type=tcp&flow=xtls-rprx-vision#IR%20Tehran'
  const report = inspectLink(link)
  assert.ok(report.ok, JSON.stringify(report.issues))
  assert.equal(report.protocol, 'vless')
  const byKey = new Map(report.fields.map((f) => [f.key, f.value]))
  assert.equal(byKey.get('address'), '1.2.3.4')
  assert.equal(byKey.get('port'), '443')
  assert.equal(byKey.get('name'), 'IR Tehran')
  assert.equal(byKey.get('network'), 'tcp')
  assert.equal(byKey.get('security'), 'reality')
  assert.equal(byKey.get('flow'), 'xtls-rprx-vision')
  // a long credential is cut in the middle, never rendered in full
  assert.equal(byKey.get('uuid'), '11111…5555')
  assert.deepEqual(
    report.issues.map((i) => i.level),
    []
  )
})

test('inspectLink flags a bad host, port and uuid', () => {
  const report = inspectLink('vless://not-a-uuid@999.1.1.1:99999?security=tls&type=ws')
  assert.equal(report.ok, false)
  const codes = report.issues.map((i) => i.text.en)
  assert.ok(codes.some((c) => c.includes('UUID is not valid')), codes.join(' | '))
  assert.ok(codes.some((c) => c.includes('Invalid port')), codes.join(' | '))
  assert.equal(report.ok, false)
  assert.equal(report.fields.find((f) => f.key === 'address')?.value, '999.1.1.1')
})

test('inspectLink rejects an unknown scheme and an empty paste', () => {
  assert.equal(inspectLink('').protocol, null)
  assert.ok(inspectLink('   ').issues.some((i) => i.text.en === 'Nothing was entered'))
  assert.ok(inspectLink('https://example.com/sub').issues.some((i) => i.text.en.includes('are supported')))
  assert.equal(inspectLink('https://example.com/sub').protocol, 'https')
})

test('inspectLink masks credentials in every reported field', () => {
  const report = inspectLink(
    'vless://11111111-2222-3333-4444-555555555555@1.2.3.4:443?security=reality&pbk=SuperSecretPublicKeyValue&type=tcp&flow=xtls-rprx-vision&sni=cdn.example-microsoft.org'
  )
  const blob = report.fields.map((f) => f.value).join(' ')
  assert.ok(!blob.includes('11111111-2222-3333-4444-555555555555'), blob)
  assert.ok(!blob.includes('SuperSecretPublicKeyValue'), blob)
  assert.ok(!blob.includes('cdn.example-microsoft.org'), blob)
  assert.ok(blob.includes('cdn.e….org'), blob)
  assert.ok(blob.includes('…'), blob)
})

test('inspectLink parses vmess base64 and ss links', () => {
  const vmess = {
    v: '2',
    ps: 'vmess node',
    add: '4.5.6.7',
    port: '443',
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    net: 'ws',
    tls: 'tls',
    sni: 'cdn.example.com'
  }
  const encoded = Buffer.from(JSON.stringify(vmess)).toString('base64')
  const report = inspectLink('vmess://' + encoded)
  assert.ok(report.ok, JSON.stringify(report.issues))
  assert.equal(report.protocol, 'vmess')
  assert.ok(report.fields.some((f) => f.key === 'network' && f.value === 'ws'))
  assert.ok(report.fields.some((f) => f.key === 'name' && f.value === 'vmess node'))
  assert.equal(report.fields.find((f) => f.key === 'address')?.value, '4.5.6.7')

  const ss = inspectLink('ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTprZXk=@9.9.9.9:8388#ss-node')
  assert.equal(ss.protocol, 'ss')
  assert.ok(ss.ok, JSON.stringify(ss.issues))
  assert.ok(ss.fields.some((f) => f.key === 'name' && f.value === 'ss-node'))
  assert.equal(ss.fields.find((f) => f.key === 'method')?.value, 'chacha20-ietf-poly1305')
})

test('inspectLink warns about tls without sni and grpc without serviceName', () => {
  const tls = inspectLink(
    'trojan://pass@2.3.4.5:443?security=tls&type=tcp#trojan-1'
  )
  assert.ok(tls.ok, JSON.stringify(tls.issues))
  assert.ok(
    tls.issues.some((i) => i.level === 'warning' && i.text.en.toLowerCase().includes('sni')),
    tls.issues.map((i) => i.text.en).join(' | ')
  )
  assert.equal(tls.fields.find((f) => f.key === 'security')?.value, 'tls')
  assert.ok(tls.fields.some((f) => f.key === 'password'))

  const grpc = inspectLink(
    'vless://11111111-2222-3333-4444-555555555555@2.3.4.5:443?security=tls&type=grpc&sni=example.org#grpc-1'
  )
  assert.ok(
    grpc.issues.some((i) => i.text.en.includes('serviceName')),
    grpc.issues.map((i) => i.text.en).join(' | ')
  )
})

test('inspectLink handles ipv6 hosts and keeps the alias tables in sync with the website', () => {
  const report = inspectLink(
    'vless://11111111-2222-3333-4444-555555555555@[2001:db8::1]:443?security=none&type=tcp#ipv6'
  )
  assert.ok(report.ok, JSON.stringify(report.issues))
  assert.equal(report.fields.find((f) => f.key === 'address')?.value, '2001:db8::1')
  assert.equal(report.fields.find((f) => f.key === 'port')?.value, '443')
  // the website validator advertises exactly the same alias tables
  assert.equal(LINK_NETWORK_ALIASES.grpc, 'grpc')
  assert.equal(LINK_SECURITY_ALIASES.reality, 'reality')
  const website = readFileSync(resolve(process.cwd(), 'website/app.js'), 'utf8')
  for (const [alias, canonical] of [...Object.entries(LINK_NETWORK_ALIASES), ...Object.entries(LINK_SECURITY_ALIASES)]) {
    if (!alias) continue
    assert.ok(website.includes(`${alias}: '${canonical}'`) || website.includes(`'${alias}'`), `website alias missing: ${alias}`)
  }
})

/* ---------------------------------------------------------- daily summary */

const DAY = 24 * 60 * 60 * 1000

test('summarizeToday sums open and closed sessions of the current calendar day', () => {
  const now = new Date('2026-02-03T18:00:00Z').getTime()
  const sessions: SessionStat[] = [
    { serverId: 'a', serverName: 'A', country: 'IR', mode: 'proxy', startedAt: now - 2 * 60 * 60 * 1000, endedAt: now - 90 * 60 * 1000, reason: 'manual' },
    { serverId: 'b', serverName: 'B', country: 'DE', mode: 'tun', startedAt: now - 30 * 60 * 1000, endedAt: 0, reason: null },
    { serverId: 'c', serverName: 'C', country: 'NL', mode: 'proxy', startedAt: now - 2 * DAY, endedAt: now - 2 * DAY + 5 * 60 * 1000, reason: 'manual' }
  ]
  const summary = summarizeToday(sessions, [], now)
  assert.equal(summary.date, '2026-02-03')
  assert.equal(summary.sessions, 2)
  // 30 min closed earlier today + 30 min still running
  assert.equal(summary.minutes, 60)
  assert.equal(summary.yesterdayMinutes, 0)
  assert.equal(summary.deltaPercent, null)
  assert.equal(summary.bestMbps, null)
  assert.equal(summary.speedSamples, 0)
})

test('summarizeToday reports best and average speed of today only', () => {
  const now = new Date('2026-02-03T18:00:00Z').getTime()
  const speed: SpeedSample[] = [
    { at: now - 3600 * 1000, mbps: 120.4, ms: 1800 },
    { at: now - 1800 * 1000, mbps: 340.8, ms: 420 },
    { at: now - 2 * DAY, mbps: 999, ms: 100 }
  ]
  const summary = summarizeToday([], speed, now)
  assert.equal(summary.bestMbps, 340.8)
  assert.equal(summary.avgMbps, 230.6)
  assert.equal(summary.speedSamples, 2)
})

test('summarizeToday compares against the previous day', () => {
  const now = new Date('2026-02-03T18:00:00Z').getTime()
  const sessions: SessionStat[] = [
    { serverId: 'a', serverName: 'A', country: 'IR', mode: 'proxy', startedAt: now - 60 * 60 * 1000, endedAt: now, reason: 'manual' },
    { serverId: 'b', serverName: 'B', country: 'IR', mode: 'proxy', startedAt: now - DAY - 2 * 60 * 60 * 1000, endedAt: now - DAY, reason: 'manual' }
  ]
  const summary = summarizeToday(sessions, [], now)
  assert.equal(summary.minutes, 60)
  assert.equal(summary.yesterdayMinutes, 120)
  assert.equal(summary.deltaPercent, -50)
  const days = aggregateStats(sessions, 3, now)
  assert.equal(days.daily[days.daily.length - 1].date, summary.date)
})

/* ------------------------------------------------------------------ report */

if (failures.length) {
  process.stderr.write(`\n✖ ${failures.length} test(s) failed:\n${failures.map((f) => `  - ${f}`).join('\n')}\n\n`)
  process.exit(1)
} else {
  process.stdout.write(`\n✔ ${passed} tests passed\n\n`)
}
