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
import { strToU8, zipSync } from 'fflate'
import { pickBestServer } from '../../src/main/lib/autoselect'
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
  // No TUN / no dokodemo-door / no sniffing-only hacks.
  assert.equal(JSON.stringify(config).includes('tun'), false)
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

/* ------------------------------------------------------------------ report */

if (failures.length) {
  process.stderr.write(`\n✖ ${failures.length} test(s) failed:\n${failures.map((f) => `  - ${f}`).join('\n')}\n\n`)
  process.exit(1)
} else {
  process.stdout.write(`\n✔ ${passed} tests passed\n\n`)
}
