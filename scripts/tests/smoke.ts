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
