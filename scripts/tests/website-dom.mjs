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

/**
 * jsdom derives its default user agent from the runner's platform, so the
 * suite pins explicit agents — otherwise the download-grid tests would expect
 * Linux on the ubuntu runner and Windows on the release runner.
 */
const UA = {
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
}

/**
 * @param file page to load
 * @param stubFetch optional canned GitHub API responder installed before app.js runs
 * @param userAgent visitor agent to simulate (defaults to Windows)
 * @param before optional hook run on the window before app.js is injected
 *        (used to seed localStorage, like a returning visitor would have)
 */
function load(file, stubFetch, userAgent = UA.win, before) {
  const dom = new JSDOM(page(file), {
    url: 'https://vpn.naxlo.ir/' + (file === 'index.html' ? '' : file),
    runScripts: 'dangerously',
    pretendToBeVisual: true
  })
  // shadow navigator.userAgent on the instance before app.js is evaluated
  Object.defineProperty(dom.window.navigator, 'userAgent', { value: userAgent, configurable: true })
  if (stubFetch) dom.window.fetch = stubFetch
  if (before) before(dom.window)
  const script = dom.window.document.createElement('script')
  script.textContent = appJs
  dom.window.document.body.appendChild(script)
  return dom
}

/** Canned GitHub payloads so the release-driven UI can be tested offline. */
const RELEASE = {
  tag_name: 'v9.9.9',
  published_at: '2026-11-09T10:00:00Z',
  html_url: 'https://github.com/Manixpcshot/Naxlo-tun/releases/tag/v9.9.9',
  body: '## Notes\n- **fixed** the digits\n- added `speedtest.php`',
  assets: [
    { name: 'Naxlo-Setup-9.9.9.exe', size: 96 * 1024 * 1024, browser_download_url: 'https://x/setup.exe' },
    { name: 'Naxlo-Portable-9.9.9.exe', size: 90 * 1024 * 1024, browser_download_url: 'https://x/portable.exe' },
    { name: 'Naxlo-Rust-Setup-9.9.9.exe', size: 12 * 1024 * 1024, browser_download_url: 'https://x/rust.exe' },
    { name: 'Naxlo-Rust-v9.9.9-linux-amd64.AppImage', size: 20 * 1024 * 1024, browser_download_url: 'https://x/app.AppImage' },
    { name: 'Naxlo-Rust-v9.9.9-linux-amd64.deb', size: 18 * 1024 * 1024, browser_download_url: 'https://x/pkg.deb' },
    { name: 'Naxlo-Rust-v9.9.9-macos-arm64.dmg', size: 15 * 1024 * 1024, browser_download_url: 'https://x/mac.dmg' },
    { name: 'Naxlo-android-v9.9.9-unsigned.apk', size: 30 * 1024 * 1024, browser_download_url: 'https://x/a.apk' }
  ]
}

const RUNS = {
  workflow_runs: [
    { name: 'Release', status: 'completed', conclusion: 'success' },
    { name: 'Android', status: 'completed', conclusion: 'failure' },
    { name: 'tauri', status: 'in_progress', conclusion: null }
  ]
}

const apiFetch = (url) => {
  const target = String(url)
  // /releases/latest → single object, /releases?per_page=N → list, /actions/runs → runs
  const body = target.includes('/actions/runs')
    ? RUNS
    : target.includes('/releases/latest')
      ? RELEASE
      : [RELEASE]
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms))

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

test('index: download grid renders from the API and leads with the visitor OS', async () => {
  const { window } = load('index.html', apiFetch, UA.win)
  await tick()
  const doc = window.document
  const cards = doc.querySelectorAll('#dl-grid .dl')
  assert.equal(cards.length, RELEASE.assets.length)
  assert.equal(cards[0].className.includes('dl--match'), true)
  assert.match(cards[0].getAttribute('href'), /setup\.exe$/)
  assert.equal(cards[0].querySelector('.yours').textContent, 'برای سیستم شما')
  // the three Windows builds lead, the other platforms follow unflagged
  assert.equal(doc.querySelectorAll('#dl-grid .dl--match').length, 3)
  assert.equal(cards[3].className.includes('dl--match'), false)
  assert.match(doc.getElementById('dl-version').textContent, /v9\.9\.9/)
})

test('index: every visitor OS gets its own card first and its own CTA', async () => {
  const expect = [
    [UA.win, /setup\.exe$/, 'دانلود برای ویندوز', 'Download for Windows'],
    [UA.mac, /mac\.dmg$/, 'دانلود برای مک', 'Download for macOS'],
    [UA.linux, /AppImage|\.deb$/, 'دانلود برای لینوکس', 'Download for Linux'],
    [UA.android, /a\.apk$/, 'دانلود برای اندروید', 'Download for Android']
  ]
  for (const [ua, href, faCta, enCta] of expect) {
    const { window } = load('index.html', apiFetch, ua)
    await tick()
    const doc = window.document
    assert.match(doc.querySelector('#dl-grid .dl').getAttribute('href'), href)
    assert.equal(doc.getElementById('hero-cta').textContent, faCta)
    doc.getElementById('lang-en').click()
    await tick()
    assert.equal(doc.getElementById('hero-cta').textContent, enCta)
  }
})

test('index: sizes and the "for your system" badge localise with the language', async () => {
  const { window } = load('index.html', apiFetch, UA.win)
  await tick()
  const doc = window.document
  assert.match(doc.querySelector('#dl-grid .size').textContent, /^[۰-۹]+[٫.][۰-۹]+ MB$/)
  // the Persian decimal separator, never a Western dot
  assert.equal(doc.querySelector('#dl-grid .size').textContent.includes('.'), false)
  doc.getElementById('lang-en').click()
  await tick()
  assert.match(doc.querySelector('#dl-grid .size').textContent, /^[0-9]+\.[0-9]+ MB$/)
  assert.equal(doc.querySelector('#dl-grid .yours').textContent, 'For your system')
  assert.match(doc.getElementById('dl-version').textContent, /Latest: v9\.9\.9/)
})

test('index: the CTA falls back to the static label when the OS is unknown', async () => {
  const { window } = load('index.html', apiFetch, 'SomeUnknownAgent/1.0')
  await tick()
  const doc = window.document
  assert.equal(doc.getElementById('hero-cta').textContent, 'دانلود برای ویندوز')
  assert.equal(doc.querySelectorAll('#dl-grid .dl--match').length, 0)
  doc.getElementById('lang-en').click()
  await tick()
  assert.equal(doc.getElementById('hero-cta').textContent, 'Download for Windows')
})

test('index: back-to-top appears after scrolling and the skip link exists', async () => {
  const { window } = load('index.html')
  const doc = window.document
  const top = doc.getElementById('totop')
  assert.equal(top.classList.contains('on'), false)
  Object.defineProperty(window, 'scrollY', { value: 900, configurable: true })
  window.dispatchEvent(new window.Event('scroll'))
  assert.equal(top.classList.contains('on'), true)
  const skip = doc.querySelector('a.skip')
  assert.equal(skip.getAttribute('href'), '#top')
  assert.equal(skip.textContent, 'پرش به محتوا')
})

test('speedtest: the nav marks the current page in both languages', async () => {
  const { window } = load('speedtest.html')
  const doc = window.document
  const active = doc.querySelector('nav a.on')
  assert.ok(active, 'no active nav link')
  assert.match(active.getAttribute('href'), /speedtest\.html$/)
  assert.equal(active.getAttribute('aria-current'), 'page')
  doc.getElementById('lang-en').click()
  await tick()
  assert.equal(doc.querySelector('nav a.on').textContent, 'Speed test')
})

test('tools: Ctrl+Enter validates and the QR actions exist', async () => {
  const { window } = load('tools.html')
  const doc = window.document
  const input = doc.getElementById('v-input')
  input.value = 'trojan://pw@example.com:443#t'
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
  await tick()
  assert.match(doc.getElementById('v-out').textContent, /trojan/)
  assert.ok(doc.getElementById('q-copy'))
  assert.ok(doc.getElementById('q-dl'))
})

test('changelog: renders notes, markdown and build chips from the API', async () => {
  const { window } = load('changelog.html', apiFetch)
  await tick(40)
  const doc = window.document
  const card = doc.querySelector('.release-card')
  assert.ok(card, 'no release card')
  assert.equal(card.querySelector('header b').textContent, 'v9.9.9')
  assert.equal(card.querySelector('.release-body b').textContent, 'Notes')
  assert.equal(card.querySelector('.release-body code').textContent, 'speedtest.php')
  const foot = card.querySelectorAll('.release-foot a')
  assert.equal(foot.length, 2)
  assert.match(foot[0].textContent, /دانلود v9\.9\.9/)
  assert.equal(foot[0].getAttribute('href'), RELEASE.html_url)
  const chips = doc.querySelectorAll('#build-strip .chip')
  assert.equal(chips.length, 3)
  assert.equal(chips[0].className.includes('pass'), true)
  assert.equal(chips[1].className.includes('fail'), true)
  assert.equal(chips[2].className.includes('run'), true)
  assert.match(chips[0].textContent, /Release — موفق/)
  assert.match(chips[2].textContent, /tauri — در حال اجرا/)
})

test('changelog: EN switch relabels the release buttons', async () => {
  const { window } = load('changelog.html', apiFetch)
  await tick(40)
  const doc = window.document
  doc.getElementById('lang-en').click()
  await tick()
  assert.match(doc.querySelector('.release-foot a').textContent, /Download v9\.9\.9/)
  assert.equal(doc.querySelectorAll('.release-foot a')[1].textContent, 'Release notes')
  assert.match(doc.querySelector('.release-card .cnt').textContent, /7 assets/)
  assert.match(doc.querySelectorAll('#build-strip .chip')[1].textContent, /Android — failed/)
})

test('static assets: sitemap, htaccess and the LTR dialog rule stay in place', () => {
  const sitemap = readFileSync(join(root, 'website', 'sitemap.xml'), 'utf8')
  for (const path of ['tools.html', 'changelog.html', 'speedtest.html']) {
    assert.ok(sitemap.includes(path), 'sitemap missing ' + path)
  }
  const htaccess = readFileSync(join(root, 'website', '.htaccess'), 'utf8')
  assert.match(htaccess, /Strict-Transport-Security/)
  assert.match(htaccess, /pretty urls/i)
  assert.match(htaccess, /speedtest\\\.\(bin\|php\)/)
  const siteCss = readFileSync(join(root, 'website', 'styles.css'), 'utf8')
  for (const rule of ['.dl--match', '.totop', '.skip', '.nav nav a.on', '.release-foot']) {
    assert.ok(siteCss.includes(rule), 'styles.css missing ' + rule)
  }
  const appCss = readFileSync(join(root, 'src/renderer/src/styles/components.css'), 'utf8')
  assert.match(appCss, /html\[dir='ltr'\] \.modal__actions \{\s*flex-direction: row-reverse/)
})

test('theme: defaults to night, toggles to day and survives a reload', async () => {
  const { window } = load('index.html')
  const doc = window.document
  assert.equal(doc.documentElement.dataset.theme, 'dark')
  const btn = doc.getElementById('theme-toggle')
  assert.ok(btn, 'no theme toggle')
  assert.equal(btn.textContent, '☀️')
  assert.equal(doc.querySelector('meta[name="theme-color"]').getAttribute('content'), '#05060a')

  btn.click()
  await tick()
  assert.equal(doc.documentElement.dataset.theme, 'light')
  assert.equal(btn.textContent, '🌙')
  assert.equal(doc.querySelector('meta[name="theme-color"]').getAttribute('content'), '#f4f6fa')
  assert.equal(window.localStorage.getItem('naxlo-site-theme'), 'light')

  // a returning visitor keeps the choice
  const again = load('index.html', undefined, UA.win, (w) => {
    w.localStorage.setItem('naxlo-site-theme', 'light')
  })
  assert.equal(again.window.document.documentElement.dataset.theme, 'light')
  assert.equal(again.window.document.getElementById('theme-toggle').textContent, '🌙')

  const css = readFileSync(join(root, 'website', 'styles.css'), 'utf8')
  assert.ok(css.includes("[data-theme='light']"), 'no light palette')
})

test('theme: the toggle label follows the language switch', async () => {
  const { window } = load('index.html')
  const doc = window.document
  const btn = doc.getElementById('theme-toggle')
  assert.equal(btn.getAttribute('aria-label'), 'حالت روز')
  assert.equal(btn.getAttribute('title'), 'حالت روز')

  doc.getElementById('lang-en').click()
  await tick()
  // no Persian may survive in English mode — not even in the a11y tree
  assert.equal(btn.getAttribute('aria-label'), 'Day mode')
  assert.equal(btn.getAttribute('title'), 'Day mode')
  assert.equal(doc.documentElement.dataset.theme, 'dark')

  btn.click()
  await tick()
  assert.equal(btn.getAttribute('aria-label'), 'Night mode')
  assert.equal(doc.documentElement.dataset.theme, 'light')
})

test('theme: a saved day theme survives an English first paint', () => {
  const { window } = load('index.html', undefined, UA.win, (w) => {
    w.localStorage.setItem('naxlo-site-theme', 'light')
    w.localStorage.setItem('naxlo-site-lang', 'en')
  })
  const doc = window.document
  assert.equal(doc.documentElement.dataset.theme, 'light')
  assert.equal(doc.documentElement.lang, 'en')
  assert.equal(window.localStorage.getItem('naxlo-site-theme'), 'light')
  assert.equal(doc.getElementById('theme-toggle').getAttribute('aria-label'), 'Night mode')
})

test('boot: a returning English visitor gets a fully wired page', async () => {
  // Regression: applyLang() used to run before the consts its render helpers
  // read, so a saved language of "en" threw a TDZ ReferenceError and aborted
  // the rest of app.js — no theme toggle, no burger menu, no validator.
  const { window } = load('tools.html', undefined, UA.win, (w) => {
    w.localStorage.setItem('naxlo-site-lang', 'en')
  })
  const doc = window.document
  assert.equal(doc.documentElement.lang, 'en')
  assert.equal(doc.documentElement.dir, 'ltr')
  assert.equal(doc.documentElement.dataset.theme, 'dark')
  assert.equal(doc.getElementById('theme-toggle').getAttribute('aria-label'), 'Day mode')

  // the validator still works, i.e. the code after the boot block ran
  const input = doc.getElementById('v-input')
  input.value = 'vless://nope@1.2.3.4:443?security=reality'
  doc.getElementById('v-btn').click()
  await tick()
  assert.match(doc.getElementById('v-out').textContent, /REALITY|UUID/i)

  // and the burger menu toggles the dropdown
  doc.getElementById('burger').click()
  assert.ok(doc.querySelector('header').classList.contains('open'))
})

test('theme: the toggle exists on every page', () => {
  for (const file of ['index.html', 'speedtest.html', 'tools.html', 'changelog.html', '404.html']) {
    const { window } = load(file)
    assert.ok(window.document.getElementById('theme-toggle'), file + ' has no theme toggle')
  }
})

test('speedtest: daily history shows the last seven days in local digits', async () => {
  const key = (offset) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - offset)
    return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
  }
  const seed = [
    { date: key(0), mbps: 210.5, at: Date.now() },
    { date: key(0), mbps: 340.25, at: Date.now() },
    { date: key(2), mbps: 88, at: Date.now() - 2 * 86400000 },
    { date: key(9), mbps: 500, at: Date.now() - 9 * 86400000 }
  ]
  const { window } = load('speedtest.html', undefined, UA.win, (w) => {
    w.localStorage.setItem('naxlo-speed-history', JSON.stringify(seed))
  })
  const doc = window.document
  const panel = doc.getElementById('st-history')
  const grid = doc.getElementById('st-history-grid')
  assert.equal(panel.hidden, false)
  assert.equal(grid.children.length, 7)
  // the best of today wins over the earlier sample, in Persian digits
  const last = grid.children[6]
  assert.equal(last.querySelector('b').textContent, '۳۴۰٫۳')
  // two days ago is the fifth column (oldest first), empty days render a dash,
  // and a sample outside the seven-day window is dropped
  assert.equal(grid.children[4].querySelector('b').textContent, '۸۸٫۰')
  assert.equal(grid.children[3].querySelector('b').textContent, '—')
  assert.ok(!grid.textContent.includes('۵۰۰'))

  doc.getElementById('lang-en').click()
  await tick()
  assert.equal(grid.children[6].querySelector('b').textContent, '340.3')
  assert.match(panel.querySelector('h3').textContent, /seven days/i)

  doc.getElementById('st-history-clear').click()
  await tick()
  assert.equal(panel.hidden, true)
  assert.equal(window.localStorage.getItem('naxlo-speed-history'), null)
})

test('speedtest: the history panel stays hidden for a first-time visitor', () => {
  const { window } = load('speedtest.html')
  assert.equal(window.document.getElementById('st-history').hidden, true)
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
