/* Naxlo website — i18n, scroll reveal, GitHub release downloads, speed test */
(function () {
  'use strict'

  let releaseCache = null

  /**
   * Persian digits AND the Persian decimal separator (٫) when the page language
   * is fa, Western otherwise — so "83.5 MB" reads «۸۳٫۵ MB» exactly like the
   * desktop app does. Only a leading number gets its dot converted, which keeps
   * file names and prose untouched.
   */
  const loc = (value) => {
    const str = String(value)
    if (document.documentElement.lang !== 'fa') return str
    const digits = str.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
    return /^\d/.test(str) ? digits.replace('.', '٫') : digits
  }

  /** Best-effort OS of the visitor, used to lead with the right download. */
  function detectOs() {
    const ua = navigator.userAgent || ''
    const plat = (navigator.userAgentData && navigator.userAgentData.platform) || ''
    if (/android/i.test(ua)) return 'android'
    if (/windows|win64|win32/i.test(plat + ua)) return 'win'
    if (/mac os x|macintosh|iphone|ipad/i.test(plat + ua)) return 'mac'
    if (/linux|x11/i.test(plat + ua)) return 'linux'
    return null
  }
  const OS_NAME = {
    win: { fa: 'ویندوز', en: 'Windows' },
    mac: { fa: 'مک', en: 'macOS' },
    linux: { fa: 'لینوکس', en: 'Linux' },
    android: { fa: 'اندروید', en: 'Android' }
  }
  const VISITOR_OS = detectOs()

  /* ---------------------------------------------------------- i18n */
  const EN = {
    brand: 'Naxlo',
    nav_features: 'Features',
    nav_how: 'How it works',
    nav_vpn: 'What is a VPN?',
    nav_download: 'Download',
    nav_speed: 'Speed test',
    nav_faq: 'FAQ',
    hero_kicker: 'Open source · No logs · Xray core',
    hero_t1: 'The internet,',
    hero_t2: 'the way it should be',
    hero_lead: 'Naxlo is a lean, open-source VPN client that reads your subscription link, lists the servers and builds a secure, stable tunnel with one click — for Windows, Linux, macOS and Android.',
    hero_cta1: 'Download for Windows',
    hero_cta2: 'Speed test in browser',
    hero_s1: 'connection core',
    hero_s2v: '4 platforms',
    hero_s2: 'Windows, Linux, macOS, Android',
    hero_s3v: '3 languages',
    hero_s3: 'Persian, English, Turkish',
    hero_s4v: '0 logs',
    hero_s4: 'nothing is ever recorded',
    feat_kicker: 'Features',
    feat_title: 'Everything a serious client needs',
    feat_sub: 'No ads, no tracking, no needless complexity.',
    f1t: 'Xray core',
    f1d: 'VLESS + REALITY, VMess and Trojan over WebSocket, gRPC and TCP — always on the latest core release.',
    f2t: 'TUN mode',
    f2d: 'A system-wide tunnel with the official Wintun driver — even apps that ignore proxy settings go through the tunnel.',
    f3t: 'Smart multi-subscription',
    f3d: 'Keep several subscription links side by side; auto-picks the best server and fails over automatically on disconnects.',
    f4t: 'Private statistics',
    f4d: 'Connection time, speed and top servers — stored only on your own device, encrypted.',
    f5t: 'Calm dark design',
    f5d: 'A near-black interface with a single accent colour, soft animations and full right-to-left Persian support.',
    f6t: 'Open & auditable',
    f6d: 'All code lives on GitHub; every release ships with checksums and detailed notes. Nothing hidden.',
    how_kicker: 'Get started',
    how_title: 'Three steps to connected',
    s1t: 'Paste your subscription link',
    s1d: 'Enter your subscription URL or open a password-protected config file; Naxlo keeps it secure and never logs it.',
    s2t: 'Pick a server',
    s2d: 'Servers show country flags, latency and quota; or let Naxlo pick the best one while respecting your pins.',
    s3t: 'Connect',
    s3d: 'One click for the local proxy, or TUN mode for the whole system. Status, speed and exit IP stay in view.',
    vpn_kicker: 'Knowledge base',
    vpn_title: 'What is a VPN and what does Naxlo do?',
    vpn_p1: '<b>VPN means “virtual private network”:</b> your device traffic travels through an encrypted tunnel instead of the open path; nobody along the way can see what you do, and your real destination hides behind the tunnel.',
    vpn_p2: 'Naxlo is a <b>client</b>: it builds the tunnel with modern protocols (VLESS/REALITY and friends) on the Xray core, but it owns no servers. You bring a subscription link from your own provider and Naxlo manages the rest.',
    vpn_p3: 'In proxy mode only proxy-aware apps use the tunnel; in <b>TUN</b> mode the entire operating system — even games and terminals — passes through it, and DNS leaks are blocked.',
    vpn_la: 'Your device',
    vpn_lb: 'Encrypted tunnel',
    dl_kicker: 'Download',
    dl_title: 'Grab the build that fits you',
    dl_sub: 'Every file comes from the official GitHub release; the list below stays in sync with the latest version automatically.',
    dl_meta_loading: 'Fetching latest release info…',
    dl_meta_all: 'All releases',
    dl_meta_src: 'Source code',
    sp_kicker: 'Speed test',
    sp_title: 'Measure your throughput',
    sp1t: 'Inside Naxlo itself',
    sp1d: 'The in-app “speed test” measures like speedtest.net: light probe, ladder size, four parallel streams and the steady-state rate after slow-start — the number lands in your stats card.',
    sp2t: 'Right now, in the browser',
    sp2d: 'If Naxlo is connected (system proxy or TUN), this test measures the very path your traffic takes right now.',
    sp2b: 'Start speed test',
    faq_kicker: 'FAQ',
    faq_title: 'Ask away',
    q1: 'Is Naxlo free?',
    a1: 'Yes — fully open source and free (libre license). No paid tiers, no ads, no tracking.',
    q2: 'Where do I get a subscription link?',
    a2: 'Naxlo ships no VPN servers; you get a subscription link from your own provider. Naxlo is only the client and reads VLESS/VMess/Trojan configs from that link.',
    q3: 'Is TUN mode safe?',
    a3: 'Yes; it uses the official signed Wintun driver and WFP filters block DNS leaks. It only activates with your explicit consent and administrator rights.',
    q4: 'Is anything logged?',
    a4: 'No. Subscription links and server details stay encrypted on your own device, and connection logs never record destinations or credentials.',
    q5: 'Which platforms are supported?',
    a5: 'Windows (Electron and Rust editions), Linux (AppImage/DEB), macOS (DMG) and Android (native Kotlin APK).',
    foot1: '© Naxlo — built for a free internet',
    foot_speed: 'Speed test',
    foot_dl: 'Download',
    skip: 'Skip to content',
    st_hist_title: 'Last seven days on this device',
    st_hist_clear: 'Clear history',
    q_copy: 'Copy link',
    q_dl: 'Download QR',
    cl_get: 'Download',
    cl_notes: 'Release notes',
    nav_cl: 'Changelog',
    nav_tools: 'Tools',
    page_title_tools: 'Tools | Naxlo',
    meta_desc_tools: 'Config validator and link-to-QR converter — fully in the browser, nothing is uploaded.',
    tools_kicker: 'Tools',
    tools_title: 'Config toolbox — everything stays in your browser',
    tools_sub: 'Nothing is uploaded; parsing, validation and QR generation are fully client-side.',
    v_title: 'Config validator',
    v_sub: 'Paste a vless / vmess / trojan / ss link and get the same parse + checks the Naxlo app itself runs.',
    v_ph: 'vless://uuid@host:443?type=ws&security=reality&pbk=...#name',
    v_btn: 'Validate',
    v_clear: 'Clear',
    q_title: 'Link ↔ QR',
    q_sub: 'Turn a config or subscription link into a QR code for your phone, or feed it a QR image to read back the text.',
    q_ph: 'vless://… or https://…',
    q_btn: 'Make QR',
    q_file: 'Read QR image',
    q_empty: 'The QR code appears here',
    page_title_cl: 'Changelog | Naxlo',
    meta_desc_cl: 'Live release history of Naxlo with the build status of each tag, straight from the GitHub API.',
    cl_kicker: 'Live changelog',
    cl_title: 'Release history + build status',
    cl_sub: 'Straight from the GitHub API; the chips above show the three workflows (Release / Android / tauri) on the latest tag.',
    cl_all: 'All releases on GitHub',
    step_n1: '1',
    step_n2: '2',
    step_n3: '3',
    page_title_home: 'Naxlo — open-source VPN client',
    page_title_speed: 'Speed test | Naxlo',
    page_title_404: '404 | Naxlo',
    meta_desc_home: 'Naxlo is a lean open-source VPN client for Windows, Linux, macOS and Android: Xray core, TUN mode, multi-subscription management and zero logs.',
    og_title: 'Naxlo | Naxlo VPN',
    og_desc: 'Open-source VPN client on the Xray core — secure tunnel, calm dark design, zero logs.',
    meta_desc_speed: 'Download speed test from the Naxlo server — the very file the Naxlo apps use to measure tunnel throughput.',
    n404_code: '404',
    n404_body: 'This page got lost in the tunnel — what you were looking for is not here.',
    n404_btn: 'Back to home',
    /* speed test page */
    st_title: 'Speed test',
    st_lead: 'A light probe sizes the line, then four parallel streams pull a ladder size (8–100 MB) for ~8 s and the steady-state rate (after slow-start) is reported. With Naxlo connected, you measure the tunnel itself.',
    st_start: 'Start test',
    st_again: 'Run again',
    st_running: 'Measuring…',
    st_done: 'Finished',
    st_fail: 'Test failed — the measurement file could not be downloaded.',
    st_mbps: 'Mbit/s',
    st_mb: 'Downloaded',
    st_sec: 'Duration',
    st_size: 'Target size × streams',
    st_note: 'Sources in order: this site (static file + on-demand generator), Cloudflare and the tele2 mirror:',
    st_back: 'Back to home'
  }

  const FA = {}
  const nodes = Array.from(document.querySelectorAll('[data-i18n]'))
  nodes.forEach((el) => { FA[el.getAttribute('data-i18n')] = el.textContent })
  const metaNodes = Array.from(document.querySelectorAll('[data-i18n-content]'))
  metaNodes.forEach((el) => { FA[el.getAttribute('data-i18n-content')] = el.getAttribute('content') || '' })
  const phNodes = Array.from(document.querySelectorAll('[data-i18n-ph]'))
  phNodes.forEach((el) => { FA[el.getAttribute('data-i18n-ph')] = el.getAttribute('placeholder') || '' })

  /* Paragraphs that carry inline emphasis: translated as markup so the bold
     survives the language switch. Values come from our own dictionaries. */
  const htmlNodes = Array.from(document.querySelectorAll('[data-i18n-html]'))
  htmlNodes.forEach((el) => { FA[el.getAttribute('data-i18n-html')] = el.innerHTML })


  function applyLang(lang) {
    const dict = lang === 'en' ? EN : FA
    nodes.forEach((el) => {
      const key = el.getAttribute('data-i18n')
      if (dict[key] != null) el.textContent = dict[key]
    })
    metaNodes.forEach((el) => {
      const key = el.getAttribute('data-i18n-content')
      if (dict[key] != null) el.setAttribute('content', dict[key])
    })
    phNodes.forEach((el) => {
      const key = el.getAttribute('data-i18n-ph')
      if (dict[key] != null) el.setAttribute('placeholder', dict[key])
    })
    htmlNodes.forEach((el) => {
      const key = el.getAttribute('data-i18n-html')
      if (dict[key] != null) el.innerHTML = dict[key]
    })
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
    document.getElementById('lang-fa')?.classList.toggle('on', lang === 'fa')
    document.getElementById('lang-en')?.classList.toggle('on', lang === 'en')
    try { localStorage.setItem('naxlo-site-lang', lang) } catch { /* private mode */ }
    renderDownloads()
    renderReleases()
    renderHistory()
    applyPlatform(lang)
  }

  /** Lead the hero CTA with the visitor's own platform when we can detect it. */
  function applyPlatform(lang) {
    const cta = document.getElementById('hero-cta')
    if (cta && VISITOR_OS && OS_NAME[VISITOR_OS]) {
      cta.textContent = lang === 'fa'
        ? 'دانلود برای ' + OS_NAME[VISITOR_OS].fa
        : 'Download for ' + OS_NAME[VISITOR_OS].en
    }
    const here = location.pathname.replace(/^\/+/, '') || 'index.html'
    document.querySelectorAll('header nav a').forEach((a) => {
      const target = (a.getAttribute('href') || '').replace(/^\/+/, '')
      const on = target.endsWith('.html') && (target === here || (here === '' && target === 'index.html'))
      a.classList.toggle('on', on)
      if (on) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })
  }

  document.getElementById('lang-fa')?.addEventListener('click', () => applyLang('fa'))
  document.getElementById('lang-en')?.addEventListener('click', () => applyLang('en'))
  let saved = 'fa'
  try { saved = localStorage.getItem('naxlo-site-lang') || 'fa' } catch { /* ignore */ }
  if (saved !== 'fa') applyLang(saved)
  else applyPlatform('fa')

  /* ------------------------------------------------ day / night theme */
  const THEME_KEY = 'naxlo-site-theme'

  const isFa = () => document.documentElement.lang !== 'en'

  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode
    const btn = document.getElementById('theme-toggle')
    if (btn) {
      btn.textContent = mode === 'light' ? '🌙' : '☀️'
      const label = mode === 'light'
        ? (isFa() ? 'حالت شب' : 'Night mode')
        : (isFa() ? 'حالت روز' : 'Day mode')
      btn.setAttribute('aria-label', label)
      btn.setAttribute('title', label)
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', mode === 'light' ? '#f4f6fa' : '#05060a')
    try { localStorage.setItem(THEME_KEY, mode) } catch { /* private mode */ }
  }

  let savedTheme = 'dark'
  try { savedTheme = localStorage.getItem(THEME_KEY) || 'dark' } catch { /* ignore */ }
  applyTheme(savedTheme === 'light' ? 'light' : 'dark')
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light')
  })

  // keep the toggle's aria-label in the current language
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

  /* ------------------------------------------------- scroll reveal */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'))
  }

  /* --------------------------------------------- release downloads */
  const PICKS = [
    { match: /^Naxlo-Setup-.*\.exe$/, icon: '🪟', os: 'win', fa: 'ویندوز — نسخهٔ اصلی', en: 'Windows — main edition', sub: { fa: 'نصب‌کنندهٔ Electron + React', en: 'Electron + React installer' } },
    { match: /^Naxlo-Portable-.*\.exe$/, icon: '🧳', os: 'win', fa: 'ویندوز — پرتابل', en: 'Windows — portable', sub: { fa: 'بدون نصب، اجرا از همین پوشه', en: 'No install, run from folder' } },
    { match: /^Naxlo-Rust-Setup-.*\.exe$/, icon: '⚙️', os: 'win', fa: 'ویندوز — نسخهٔ Rust', en: 'Windows — Rust edition', sub: { fa: 'سبک‌تر، با هستهٔ Tauri', en: 'Leaner, Tauri based' } },
    { match: /linux-amd64\.AppImage$/, icon: '🐧', os: 'linux', fa: 'لینوکس — AppImage', en: 'Linux — AppImage', sub: { fa: 'اجرا بدون نصب', en: 'Run without installing' } },
    { match: /linux-amd64\.deb$/, icon: '📦', os: 'linux', fa: 'لینوکس — DEB', en: 'Linux — DEB', sub: { fa: 'دبیان و اوبونتو', en: 'Debian & Ubuntu' } },
    { match: /macos-.*\.dmg$/, icon: '🍎', os: 'mac', fa: 'مک — DMG', en: 'macOS — DMG', sub: { fa: 'Apple Silicon', en: 'Apple Silicon' } },
    { match: /android-.*-unsigned\.apk$/, icon: '🤖', os: 'android', fa: 'اندروید — APK', en: 'Android — APK', sub: { fa: 'کلاینت بومی Kotlin', en: 'Native Kotlin client' } }
  ]

  const fmtSize = (n) => loc(n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB')

  function renderDownloads() {
    const grid = document.getElementById('dl-grid')
    const metaEl = document.getElementById('dl-version')
    if (!grid || !releaseCache) return
    const lang = document.documentElement.lang === 'en' ? 'en' : 'fa'
    grid.innerHTML = ''
    const ordered = VISITOR_OS
      ? PICKS.slice().sort((x, y) => Number(y.os === VISITOR_OS) - Number(x.os === VISITOR_OS))
      : PICKS
    for (const pick of ordered) {
      const asset = releaseCache.assets.find((a) => pick.match.test(a.name))
      if (!asset) continue
      const mine = VISITOR_OS === pick.os
      const a = document.createElement('a')
      a.className = 'dl reveal in' + (mine ? ' dl--match' : '')
      a.href = asset.browser_download_url
      a.target = '_blank'
      a.rel = 'noopener'
      a.innerHTML =
        '<span class="pico">' + pick.icon + '</span><span><b></b><span></span></span>' +
        (mine ? '<span class="yours"></span>' : '') +
        '<span class="size">' + fmtSize(asset.size) + '</span>'
      a.querySelector('b').textContent = pick[lang]
      a.querySelectorAll('span span')[0].textContent = pick.sub[lang]
      if (mine) a.querySelector('.yours').textContent = lang === 'fa' ? 'برای سیستم شما' : 'For your system'
      grid.appendChild(a)
    }
    if (metaEl) {
      metaEl.textContent = (lang === 'fa' ? 'آخرین نسخه: ' : 'Latest: ') + releaseCache.tag_name +
        (releaseCache.published_at
          ? ' · ' + new Date(releaseCache.published_at).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB')
          : '')
    }
  }

  async function loadDownloads() {
    const metaEl = document.getElementById('dl-version')
    try {
      const res = await fetch('https://api.github.com/repos/Manixpcshot/Naxlo-tun/releases/latest')
      if (!res.ok) throw new Error('http ' + res.status)
      const data = await res.json()
      releaseCache = { assets: data.assets || [], tag_name: data.tag_name || '', published_at: data.published_at || '' }
      renderDownloads()
    } catch {
      const lang = document.documentElement.lang === 'en' ? 'en' : 'fa'
      if (metaEl) {
        metaEl.innerHTML = lang === 'fa'
          ? 'فهرست خودکار در دسترس نیست — <a href="https://github.com/Manixpcshot/Naxlo-tun/releases/latest">صفحهٔ انتشار</a> را ببینید.'
          : 'Auto list unavailable — see the <a href="https://github.com/Manixpcshot/Naxlo-tun/releases/latest">releases page</a>.'
      }
    }
  }
  loadDownloads()

  /* -------------------------------------------------- back to top */
  const totop = document.getElementById('totop')
  if (totop) {
    const onScroll = () => totop.classList.toggle('on', (window.scrollY || 0) > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    totop.addEventListener('click', () => {
      if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' })
      else window.scrollTo(0, 0)
    })
  }

  /* ------------------------------------------------- burger + tools */
  const burger = document.getElementById('burger')
  if (burger) {
    burger.addEventListener('click', () => document.querySelector('header')?.classList.toggle('open'))
    document.querySelectorAll('.nav nav a').forEach((a) =>
      a.addEventListener('click', () => document.querySelector('header')?.classList.remove('open'))
    )
  }

  const maskMid = (v) => (v && v.length > 12 ? v.slice(0, 5) + '…' + v.slice(-4) : v || '—')

  /* client-side config validator — mirrors src/main/lib/parseConfig.ts */
  const NET_ALIASES = { tcp: 'tcp', ws: 'ws', websocket: 'ws', grpc: 'grpc', gun: 'grpc', multi: 'grpc', h2: 'h2', http: 'h2', quic: 'quic', kcp: 'kcp', mkcp: 'kcp', splithttp: 'splithttp', xhttp: 'xhttp', xudp: 'tcp' }
  const SEC_ALIASES = { none: 'none', '': 'none', tls: 'tls', xtls: 'xtls', reality: 'reality', recon: 'reality' }
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

  function b64dec(input) {
    try { return decodeURIComponent(escape(atob(input.replace(/-/g, '+').replace(/_/g, '/')))) } catch { /* fall through */ }
    try { return atob(input) } catch { return null }
  }

  function parseAuthority(authority, fields, err) {
    let host = authority
    let port = 443
    if (host.startsWith('[')) {
      const close = host.indexOf(']')
      if (close > 0) { port = Number(host.slice(close + 2)) || 443; host = host.slice(1, close) }
    } else {
      const colon = host.lastIndexOf(':')
      if (colon > 0) { port = Number(host.slice(colon + 1)) || 443; host = host.slice(0, colon) }
    }
    fields.address = maskMid(host)
    fields.port = String(port)
    if (!host) err('آدرس سرور خالی است', 'Server address is empty')
    if (!Number.isInteger(port) || port < 1 || port > 65535) err('پورت معتبر نیست (' + port + ')', 'Invalid port (' + port + ')')
  }

  function validateLink(input) {
    const issues = []
    const fields = {}
    const err = (fa, en) => issues.push({ lvl: 'err', fa, en })
    const warn = (fa, en) => issues.push({ lvl: 'warn', fa, en })
    const raw = (input || '').trim()
    if (!raw) return { fields: null, issues: [{ lvl: 'err', fa: 'چیزی وارد نشده است', en: 'Nothing pasted' }] }

    if (raw.startsWith('vless://') || raw.startsWith('trojan://')) {
      const isVless = raw.startsWith('vless://')
      fields.protocol = isVless ? 'vless' : 'trojan'
      const body = raw.slice(isVless ? 8 : 9)
      const hash = body.indexOf('#')
      const main = hash >= 0 ? body.slice(0, hash) : body
      if (hash >= 0) fields.name = decodeURIComponent(body.slice(hash + 1).replace(/[%20]/g, ' ')).slice(0, 24) || undefined
      const at = main.indexOf('@')
      if (at < 0) { err('بخش اعتبارنامه (@) وجود ندارد', 'Missing credential (@) section'); return { fields, issues } }
      const credential = main.slice(0, at)
      const rest = main.slice(at + 1)
      if (isVless) { fields.uuid = credential ? credential.slice(0, 8) + '…' : '—'; if (!UUID_RE.test(credential)) err('UUID معتبر نیست', 'UUID is not valid') }
      else if (!credential) err('رمز trojan خالی است', 'Trojan password is empty')
      const q = rest.indexOf('?')
      const params = new URLSearchParams(q >= 0 ? rest.slice(q + 1) : '')
      parseAuthority(q >= 0 ? rest.slice(0, q) : rest, fields, err)
      const netRaw = (params.get('type') || params.get('network') || 'tcp').toLowerCase()
      const network = NET_ALIASES[netRaw]
      if (!network) err('شبکه ناشناخته: ' + netRaw, 'Unknown network: ' + netRaw)
      else fields.network = network
      const secRaw = (params.get('security') || (isVless ? 'none' : 'tls')).toLowerCase()
      const security = SEC_ALIASES[secRaw]
      if (security === undefined) warn('لایهٔ امنیتی ناشناخته: ' + secRaw, 'Unknown security: ' + secRaw)
      else fields.security = security
      if (security === 'reality') {
        if (!params.get('pbk')) err('کلید عمومی REALITY (pbk) وجود ندارد — کانفیگ کار نمی‌کند', 'REALITY public key (pbk) missing — the config cannot work')
        else fields.pbk = maskMid(params.get('pbk'))
        if (!params.get('sni')) warn('SNI برای REALITY توصیه می‌شود', 'SNI is recommended for REALITY')
      }
      if (security === 'tls' && !params.get('sni')) warn('SNI نبود؛ ناکسو آدرس سرور را جایگزین می‌کند', 'No SNI; Naxlo falls back to the server address')
      if (params.get('sni')) fields.sni = maskMid(params.get('sni'))
      if (network === 'grpc' && !params.get('serviceName')) warn('serviceName برای gRPC خالی است', 'serviceName is empty for gRPC')
      if (network === 'ws' && params.get('path')) fields.path = params.get('path')
      if (isVless && security === 'tls' && network === 'tcp' && params.get('flow') !== 'xtls-rprx-vision') {
        warn('flow=xtls-rprx-vision برای VLESS+TLS+TCP توصیه می‌شود', 'flow=xtls-rprx-vision is recommended for VLESS+TLS+TCP')
      }
    } else if (raw.startsWith('vmess://')) {
      fields.protocol = 'vmess'
      const json = b64dec(raw.slice(8))
      if (!json) { err('Base64 نامعتبر است', 'Invalid Base64'); return { fields, issues } }
      let data
      try { data = JSON.parse(json) } catch { err('JSON داخل vmess خراب است', 'The JSON inside vmess is corrupt'); return { fields, issues } }
      if (data.add) fields.address = maskMid(String(data.add))
      else err('آدرس (add) وجود ندارد', 'Missing address (add)')
      const port = Number(data.port)
      fields.port = String(data.port ?? '')
      if (!port || port < 1 || port > 65535) err('پورت معتبر نیست', 'Invalid port')
      fields.uuid = data.id ? String(data.id).slice(0, 8) + '…' : '—'
      if (!UUID_RE.test(String(data.id ?? ''))) err('UUID معتبر نیست', 'UUID is not valid')
      const network = NET_ALIASES[String(data.net ?? 'tcp').toLowerCase()]
      if (!network) err('شبکه ناشناخته: ' + data.net, 'Unknown network: ' + data.net)
      else fields.network = network
      const security = SEC_ALIASES[String(data.tls ?? 'none').toLowerCase()] ?? 'none'
      fields.security = security
      if (security === 'tls' && !data.sni && !data.host) warn('SNI نبود؛ ناکسو آدرس سرور را جایگزین می‌کند', 'No SNI; Naxlo falls back to the server address')
      if (data.ps) fields.name = String(data.ps).slice(0, 24)
    } else if (raw.startsWith('ss://')) {
      fields.protocol = 'shadowsocks'
      let body = raw.slice(5)
      const hash = body.indexOf('#')
      if (hash >= 0) { fields.name = decodeURIComponent(body.slice(hash + 1)).slice(0, 24) || undefined; body = body.slice(0, hash) }
      let userinfo = null
      let authority = body
      const at = body.lastIndexOf('@')
      if (at > 0) { userinfo = b64dec(body.slice(0, at)); authority = body.slice(at + 1) }
      else {
        const decoded = b64dec(body)
        if (decoded && decoded.includes('@')) {
          const a2 = decoded.lastIndexOf('@')
          userinfo = decoded.slice(0, a2)
          authority = decoded.slice(a2 + 1)
        }
      }
      if (userinfo && userinfo.includes(':')) fields.method = userinfo.slice(0, userinfo.indexOf(':'))
      else warn('بخش method:password خوانده نشد', 'Could not read the method:password part')
      parseAuthority(authority, fields, err)
    } else {
      err('فرمت لینک ناشناخته است (vless/vmess/trojan/ss)', 'Unknown link format (vless/vmess/trojan/ss)')
    }
    return { fields, issues }
  }

  const vBtn = document.getElementById('v-btn')
  if (vBtn) {
    const out = document.getElementById('v-out')
    const render = () => {
      const { fields, issues } = validateLink(document.getElementById('v-input').value)
      out.innerHTML = ''
      if (fields) {
        const kv = document.createElement('div')
        kv.className = 'kv'
        for (const [key, value] of Object.entries(fields)) {
          const chip = document.createElement('span')
          chip.textContent = key + ': ' + value
          kv.appendChild(chip)
        }
        out.appendChild(kv)
      }
      if (!issues.length) {
        const ok = document.createElement('div')
        ok.className = 'issue okk'
        ok.innerHTML = '<span class="ic">✓</span><p></p>'
        ok.querySelector('p').textContent = isFa() ? 'کانفیگ معتبر است — هیچ مشکلی پیدا نشد.' : 'The config is valid — no issues found.'
        out.appendChild(ok)
      }
      for (const issue of issues) {
        const row = document.createElement('div')
        row.className = 'issue ' + (issue.lvl === 'err' ? 'err' : 'warn')
        row.innerHTML = '<span class="ic"></span><p></p>'
        row.querySelector('.ic').textContent = issue.lvl === 'err' ? '✕' : '!'
        row.querySelector('p').textContent = isFa() ? issue.fa : issue.en
        out.appendChild(row)
      }
    }
    vBtn.addEventListener('click', render)
    const vInput = document.getElementById('v-input')
    vInput.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); render() }
    })
    document.getElementById('v-clear').addEventListener('click', () => {
      document.getElementById('v-input').value = ''
      out.innerHTML = ''
    })
  }

  /* ------------------------------------------------------ qr make/read */
  const qBtn = document.getElementById('q-btn')
  if (qBtn && typeof window.qrcode === 'function') {
    qBtn.addEventListener('click', () => {
      const text = document.getElementById('q-input').value.trim()
      const box = document.getElementById('q-box')
      if (!text) return
      try {
        const qr = window.qrcode(0, 'M')
        qr.addData(text)
        qr.make()
        box.className = 'qr-box'
        box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
      } catch {
        box.className = 'qr-box empty'
        box.textContent = isFa() ? 'ساخت QR ممکن نشد' : 'Could not build the QR'
      }
    })
  }
  const qCopy = document.getElementById('q-copy')
  if (qCopy) {
    qCopy.addEventListener('click', () => {
      const text = document.getElementById('q-input').value.trim()
      if (!text) return
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => undefined)
      qCopy.dataset.done = '1'
      setTimeout(() => { delete qCopy.dataset.done }, 1400)
    })
  }
  const qDl = document.getElementById('q-dl')
  if (qDl) {
    qDl.addEventListener('click', () => {
      const svg = document.querySelector('#q-box svg')
      if (!svg) return
      const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'naxlo-config-qr.svg'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    })
  }

  const qFile = document.getElementById('q-file')
  if (qFile && typeof window.jsQR === 'function') {
    qFile.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = window.jsQR(data.data, canvas.width, canvas.height)
        const out = document.getElementById('q-decoded')
        out.innerHTML = ''
        if (result && result.data) {
          const ta = document.createElement('textarea')
          ta.value = result.data
          ta.readOnly = true
          ta.style.minHeight = '70px'
          out.appendChild(ta)
          const use = document.createElement('button')
          use.className = 'btn btn-ghost'
          use.style.marginTop = '10px'
          use.textContent = isFa() ? 'بفرست به اعتبارسنج' : 'Send to validator'
          use.addEventListener('click', () => {
            document.getElementById('v-input').value = result.data
            document.getElementById('v-btn').click()
          })
          out.appendChild(use)
        } else {
          out.textContent = isFa() ? 'QR از این تصویر خوانده نشد' : 'No QR could be read from this image'
        }
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  /* ------------------------------------------------- live changelog */
  const relRoot = document.getElementById('releases')
  let releasesCache = null
  let runsCache = null

  const esc = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const mdLite = (value) => esc(value)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>')

  const RUN_WORD = {
    pass: { fa: 'موفق', en: 'passed' },
    fail: { fa: 'ناموفق', en: 'failed' },
    run: { fa: 'در حال اجرا', en: 'running' }
  }

  function renderChips() {
    const strip = document.getElementById('build-strip')
    if (!strip || !runsCache || !releasesCache || !releasesCache.length) return
    const tag = releasesCache[0].tag_name
    const latest = {}
    for (const run of runsCache.workflow_runs || []) if (!latest[run.name]) latest[run.name] = run
    strip.innerHTML = ''
    for (const name of ['Release', 'Android', 'tauri']) {
      const run = latest[name]
      if (!run) continue
      const state = run.status === 'completed' ? (run.conclusion === 'success' ? 'pass' : 'fail') : 'run'
      const chip = document.createElement('span')
      chip.className = 'chip ' + state
      chip.title = name + ' · ' + tag + ' · ' + (run.conclusion || run.status)
      chip.innerHTML = '<i></i>'
      chip.appendChild(document.createTextNode(
        name + ' — ' + (isFa() ? RUN_WORD[state].fa : RUN_WORD[state].en)
      ))
      strip.appendChild(chip)
    }
  }

  /** Release cards are rebuilt on every language switch so their labels follow it. */
  function renderReleases() {
    if (!relRoot || !releasesCache) return
    relRoot.innerHTML = ''
    for (const rel of releasesCache) {
      const card = document.createElement('article')
      card.className = 'release-card reveal in'
      const head = document.createElement('header')
      head.innerHTML = '<b></b><time></time><span class="cnt"></span>'
      head.querySelector('b').textContent = rel.tag_name
      head.querySelector('time').textContent = new Date(rel.published_at).toLocaleDateString(isFa() ? 'fa-IR' : 'en-GB')
      head.querySelector('.cnt').textContent = (rel.assets || []).length + (isFa() ? ' فایل' : ' assets')
      card.appendChild(head)
      const body = document.createElement('div')
      body.className = 'release-body'
      body.innerHTML = mdLite(rel.body || '')
      card.appendChild(body)
      const foot = document.createElement('div')
      foot.className = 'release-foot'
      const get = document.createElement('a')
      get.className = 'btn btn-primary'
      get.href = rel.html_url
      get.target = '_blank'
      get.rel = 'noopener'
      get.textContent = isFa() ? 'دانلود ' + rel.tag_name : 'Download ' + rel.tag_name
      const notes = document.createElement('a')
      notes.className = 'btn btn-ghost'
      notes.href = rel.html_url
      notes.target = '_blank'
      notes.rel = 'noopener'
      notes.textContent = isFa() ? 'یادداشت انتشار' : 'Release notes'
      foot.appendChild(get)
      foot.appendChild(notes)
      card.appendChild(foot)
      relRoot.appendChild(card)
    }
    renderChips()
  }

  function releasesFallback() {
    if (!relRoot) return
    relRoot.textContent = isFa()
      ? 'دریافت تغییرات ممکن نشد — اینترنت یا API در دسترس نیست.'
      : 'Could not fetch releases — the API is unreachable.'
  }

  if (relRoot) {
    try {
      if (typeof fetch !== 'function') throw new Error('no fetch')
      fetch('https://api.github.com/repos/Manixpcshot/Naxlo-tun/releases?per_page=12')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('http ' + res.status))))
        .then((list) => {
          releasesCache = Array.isArray(list) ? list : null
          if (!releasesCache) throw new Error('unexpected payload')
          renderReleases()
          const tag = releasesCache[0] && releasesCache[0].tag_name
          if (!tag) return
          return fetch('https://api.github.com/repos/Manixpcshot/Naxlo-tun/actions/runs?branch=' + encodeURIComponent(tag) + '&per_page=15')
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error('runs'))))
            .then((runs) => { runsCache = runs; renderChips() })
            .catch(() => { /* the status strip is best-effort */ })
        })
        .catch(releasesFallback)
    } catch {
      releasesFallback()
    }
  }

  /* ------------------------------------- daily speed history (on-device) */
  const HISTORY_KEY = 'naxlo-speed-history'
  const HISTORY_DAYS = 7

  function readHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      return Array.isArray(raw) ? raw.filter((r) => r && typeof r.mbps === 'number' && typeof r.date === 'string') : []
    } catch {
      return []
    }
  }

  function dayKey(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return date.getFullYear() + '-' + m + '-' + d
  }

  function recordSpeed(mbps) {
    const list = readHistory()
    list.push({ date: dayKey(new Date()), mbps: Math.round(mbps * 10) / 10, at: Date.now() })
    // keep at most 200 samples, newest last
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-200))) } catch { /* private mode */ }
    renderHistory()
  }

  function renderHistory() {
    const panel = document.getElementById('st-history')
    const grid = document.getElementById('st-history-grid')
    if (!panel || !grid) return
    const list = readHistory()
    if (!list.length) { panel.hidden = true; return }

    // best result of each of the last HISTORY_DAYS local days
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = []
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const day = new Date(today)
      day.setDate(today.getDate() - i)
      days.push(dayKey(day))
    }
    const best = {}
    for (const item of list) if (!best[item.date] || item.mbps > best[item.date]) best[item.date] = item.mbps
    const peak = Math.max(1, ...days.map((key) => best[key] || 0))

    grid.innerHTML = ''
    for (const key of days) {
      const value = best[key]
      const cell = document.createElement('div')
      cell.className = 'history__col'
      const bar = document.createElement('i')
      bar.style.height = Math.max(4, Math.round(((value || 0) / peak) * 100)) + '%'
      const num = document.createElement('b')
      num.textContent = value ? loc(value.toFixed(1)) : '—'
      const label = document.createElement('span')
      label.textContent = key.slice(5).replace('-', '/')
      cell.appendChild(document.createElement('div')).className = 'history__track'
      cell.querySelector('.history__track').appendChild(bar)
      cell.appendChild(num)
      cell.appendChild(label)
      grid.appendChild(cell)
    }
    panel.hidden = false
  }

  document.getElementById('st-history-clear')?.addEventListener('click', () => {
    try { localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ }
    renderHistory()
  })
  renderHistory()

  /* --------------------------------------------------- speed test */
  /* Adaptive, speedtest.net-style: 2 MB probe → ladder size → 4 parallel
     streams for ~8 s → steady-state rate (slow-start ramp excluded). */
  const SPEED = {
    PROBE_BYTES: 2 * 1048576,
    PROBE_MS: 4000,
    MAIN_MS: 8000,
    RAMP_MS: 1500,
    STREAMS: 4,
    LADDER: [8, 16, 32, 64, 100]
  }
  const pickSizeMb = (mbps) => {
    if (!isFinite(mbps) || mbps <= 0) return SPEED.LADDER[0]
    const ideal = (mbps * (SPEED.MAIN_MS / 1000)) / 8
    for (const step of SPEED.LADDER) if (step >= ideal) return step
    return 100
  }
  const steadyMbps = (total, ramp, ms) => {
    const win = Math.max(200, ms - SPEED.RAMP_MS)
    return ((total - ramp) * 8) / win / 1000
  }
  const tele2Size = (mb) => [10, 20, 50, 100].filter((n) => n <= mb).pop() || 10
  const speedUrl = (base, sizeMb, nonce) => {
    const bytes = sizeMb * 1048576
    if (base === 'own') {
      return sizeMb <= 10
        ? '/speedtest.bin?r=' + nonce
        : '/speedtest.php?bytes=' + bytes + '&r=' + nonce
    }
    if (base === 'cloudflare') return 'https://speed.cloudflare.com/__down?bytes=' + bytes
    return 'https://speedtest.tele2.net/' + tele2Size(sizeMb) + 'MB.zip'
  }
  async function streamFetch(url, capBytes, deadline, addBytes) {
    let bytes = 0
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok || !res.body) return { ok: false, bytes: 0 }
      const reader = res.body.getReader()
      for (;;) {
        if (performance.now() >= deadline) { await reader.cancel(); break }
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.length
        addBytes(value.length)
        if (bytes >= capBytes) { await reader.cancel(); break }
      }
      return { ok: bytes > 0, bytes }
    } catch {
      return { ok: bytes > 0, bytes }
    }
  }

  const gauge = document.getElementById('gauge-val')
  if (gauge) {
    const btn = document.getElementById('st-btn')
    const bar = document.getElementById('st-bar')
    const log = document.getElementById('st-log')
    const arc = document.getElementById('st-arc')
    const mbEl = document.getElementById('st-mb')
    const secEl = document.getElementById('st-sec')
    const sizeEl = document.getElementById('st-size')
    const CIRC = 2 * Math.PI * 110
    let running = false
    let scale = 100

    const setArc = (mbps) => {
      while (mbps > scale && scale < 2000) scale *= 2
      arc.style.strokeDashoffset = String(CIRC * (1 - Math.max(0, Math.min(mbps / scale, 1))))
    }

    btn.addEventListener('click', async () => {
      if (running) return
      running = true
      btn.disabled = true
      btn.textContent = EN.st_running
      log.textContent = ''
      const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'fa')
      const nonce = Date.now()
      let total = 0
      const addBytes = (d) => { total += d }
      const startedAll = performance.now()
      const tick = setInterval(() => {
        const ms = performance.now() - startedAll
        mbEl.textContent = loc((total / 1048576).toFixed(2) + ' MB')
        secEl.textContent = loc((ms / 1000).toFixed(1) + ' s')
      }, 120)

      let final = null
      for (const base of ['own', 'cloudflare', 'tele2']) {
        total = 0
        const probeStart = performance.now()
        const probe = await streamFetch(speedUrl(base, 2, nonce), SPEED.PROBE_BYTES, probeStart + SPEED.PROBE_MS, () => {})
        const probeMs = performance.now() - probeStart
        if (!probe.ok || probe.bytes < 65536 || probeMs <= 0) continue
        const probeMbps = (probe.bytes * 8) / probeMs / 1000
        const sizeMb = pickSizeMb(probeMbps)
        if (sizeEl) sizeEl.textContent = loc(sizeMb + ' MB × ' + SPEED.STREAMS)

        total = 0
        const started = performance.now()
        const deadline = started + SPEED.MAIN_MS
        let ramp = 0
        let rampTaken = false
        const rampTimer = setTimeout(() => { ramp = total; rampTaken = true }, SPEED.RAMP_MS)
        const live = setInterval(() => {
          const ms = performance.now() - started
          const mbps = ms > 300 ? steadyMbps(total, rampTaken ? ramp : 0, Math.max(ms, SPEED.RAMP_MS + 200)) : 0
          gauge.textContent = loc(mbps.toFixed(1))
          setArc(mbps)
          bar.style.width = Math.min((mbps / scale) * 100, 100) + '%'
          mbEl.textContent = loc((total / 1048576).toFixed(2) + ' MB')
          secEl.textContent = loc((ms / 1000).toFixed(1) + ' s')
        }, 120)
        const results = await Promise.all(
          Array.from({ length: SPEED.STREAMS }, () =>
            streamFetch(speedUrl(base, sizeMb, nonce), sizeMb * 1048576, deadline, addBytes)
          )
        )
        clearInterval(live)
        clearTimeout(rampTimer)
        if (!rampTaken) ramp = total
        const elapsed = performance.now() - started
        if (!results.some((r) => r.ok) || total < 262144) continue
        const mbps = steadyMbps(total, ramp, elapsed)
        final = { mbps, sizeMb, base }
        recordSpeed(mbps)
        gauge.textContent = loc(mbps.toFixed(1))
        setArc(mbps)
        bar.style.width = Math.min((mbps / scale) * 100, 100) + '%'
        break
      }
      clearInterval(tick)
      if (final) {
        log.textContent = loc(lang() === 'fa'
          ? 'پایان — حجم ' + final.sizeMb + ' مگابایت با ' + SPEED.STREAMS + ' جریان هم‌زمان'
          : 'Done — ' + final.sizeMb + ' MB over ' + SPEED.STREAMS + ' parallel streams')
      } else {
        log.textContent = document.documentElement.lang === 'fa'
          ? 'تست ناموفق بود — فایل اندازه‌گیری در دسترس نیست.'
          : EN.st_fail
      }
      running = false
      btn.disabled = false
      btn.textContent = EN.st_again
    })
  }
})()
