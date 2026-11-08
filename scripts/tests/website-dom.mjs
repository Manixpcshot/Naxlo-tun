#!/usr/bin/env node
/**
 * Website DOM tests — loads the static pages in jsdom, injects app.js and
 * asserts the behaviour a browser would show: fa/EN switching (including the
 * step numerals and titles), the client-side config validator and the
 * graceful fallbacks when the GitHub API / measurement files are unreachable.
 * No network access is used; `fetch` is deliberately absent in jsdom.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const page = (file) => readFileSync(join(root, 'website', file), 'utf8')
const appJs = readFileSync(join(root, 'website', 'app.js'), 'utf8')

function load(file) {
  const dom = new JSDOM(page(file), {
    url: 'https://vpn.naxlo.ir/' + (file === 'index.html' ? '' : file),
    runScripts: 'dangerously',
    pretendToBeVisual: true
  })
  const script = dom.window.document.createElement('script')
  script.textContent = appJs
  dom.window.document.body.appendChild(script)
  return dom
}

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('index: fa is the default (rtl, persian step numerals)', () => {
  const { window } = load('index.html')
  const doc = window.document
  assert.equal(doc.documentElement.lang, 'fa')
  assert.equal(doc.documentElement.dir, 'rtl')
  const nums = doc.querySelectorAll('.num')
  assert.equal(nums.length, 3)
  assert.equal(nums[0].textContent, '۱')
})

test('index: EN switch flips dir, titles and numerals', () => {
  const { window } = load('index.html')
  const doc = window.document
  doc.getElementById('lang-en').click()
  assert.equal(doc.documentElement.lang, 'en')
  assert.equal(doc.documentElement.dir, 'ltr')
  assert.equal(doc.querySelectorAll('.num')[0].textContent, '1')
  assert.equal(doc.querySelector('[data-i18n="nav_features"]').textContent, 'Features')
  assert.equal(doc.title, 'Naxlo — open-source VPN client')
  assert.equal(doc.querySelector('meta[name=description]').getAttribute('content').startsWith('Naxlo is'), true)
  // and back to fa
  doc.getElementById('lang-fa').click()
  assert.equal(doc.querySelectorAll('.num')[0].textContent, '۱')
  assert.equal(doc.documentElement.dir, 'rtl')
})

test('index: download list falls back gracefully without the API', () => {
  const { window } = load('index.html')
  const meta = window.document.getElementById('dl-version')
  assert.match(meta.textContent, /releases|انتشار/)
})

test('tools: validator flags a REALITY config without pbk', () => {
  const { window } = load('tools.html')
  const doc = window.document
  doc.getElementById('v-input').value =
    'vless://12345678-1234-1234-1234-123456789012@example.com:443?type=tcp&security=reality&sni=cdn.example.com#test'
  doc.getElementById('v-btn').click()
  const out = doc.getElementById('v-out').textContent
  assert.match(out, /REALITY/)
  assert.match(out, /pbk/)
  // uuid chip is masked, never the full credential
  assert.match(out, /uuid: 12345678…/)
  assert.ok(!out.includes('12345678-1234-1234-1234-123456789012'))
})

test('tools: validator accepts a complete vless config', () => {
  const { window } = load('tools.html')
  const doc = window.document
  doc.getElementById('v-input').value =
    'vless://12345678-1234-1234-1234-123456789012@example.com:443?type=ws&security=reality&pbk=abcdefghijklmnop&sni=cdn.example.com&path=/x#ok'
  doc.getElementById('v-btn').click()
  const out = doc.getElementById('v-out').textContent
  assert.match(out, /معتبر/)
  assert.match(out, /network: ws/)
})

test('tools: validator reports bad ports and unknown networks in EN', () => {
  const { window } = load('tools.html')
  const doc = window.document
  doc.getElementById('lang-en').click()
  doc.getElementById('v-input').value = 'vless://12345678-1234-1234-1234-123456789012@example.com:99999?type=carrier'
  doc.getElementById('v-btn').click()
  const out = doc.getElementById('v-out').textContent
  assert.match(out, /Invalid port/)
  assert.match(out, /Unknown network: carrier/)
})

test('tools: vmess with corrupt base64 is an error, not a crash', () => {
  const { window } = load('tools.html')
  const doc = window.document
  doc.getElementById('v-input').value = 'vmess://!!!not-base64!!!'
  doc.getElementById('v-btn').click()
  assert.match(doc.getElementById('v-out').textContent, /Base64|ناشطة|نامعتبر/)
})

test('changelog: shows the fallback message when the API is unreachable', () => {
  const { window } = load('changelog.html')
  const rootEl = window.document.getElementById('releases')
  assert.match(rootEl.textContent, /دریافت تغییرات|Could not fetch/)
})

test('speedtest: gauge exists and a failed run localises the message', async () => {
  const { window } = load('speedtest.html')
  const doc = window.document
  assert.ok(doc.getElementById('gauge-val'))
  doc.getElementById('st-btn').click()
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.match(doc.getElementById('st-log').textContent, /تست ناموفق|failed/)
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    process.stdout.write(`  ✔ website: ${name}\n`)
  } catch (err) {
    failed += 1
    process.stdout.write(`  ✖ website: ${name}\n    ${err.message}\n`)
  }
}
if (failed > 0) process.exitCode = 1
