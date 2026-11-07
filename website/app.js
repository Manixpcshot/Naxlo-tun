/* Naxlo website — i18n, scroll reveal, GitHub release downloads, speed test */
(function () {
  'use strict'

  let releaseCache = null

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
    vpn_p1: 'VPN means “virtual private network”: your device traffic travels through an encrypted tunnel instead of the open path; nobody along the way can see what you do, and your real destination hides behind the tunnel.',
    vpn_p2: 'Naxlo is a client: it builds the tunnel with modern protocols (VLESS/REALITY and friends) on the Xray core, but it owns no servers. You bring a subscription link from your own provider and Naxlo manages the rest.',
    vpn_p3: 'In proxy mode only proxy-aware apps use the tunnel; in TUN mode the entire operating system — even games and terminals — passes through it, and DNS leaks are blocked.',
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
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
    document.getElementById('lang-fa')?.classList.toggle('on', lang === 'fa')
    document.getElementById('lang-en')?.classList.toggle('on', lang === 'en')
    try { localStorage.setItem('naxlo-site-lang', lang) } catch { /* private mode */ }
    renderDownloads()
  }

  document.getElementById('lang-fa')?.addEventListener('click', () => applyLang('fa'))
  document.getElementById('lang-en')?.addEventListener('click', () => applyLang('en'))
  let saved = 'fa'
  try { saved = localStorage.getItem('naxlo-site-lang') || 'fa' } catch { /* ignore */ }
  if (saved !== 'fa') applyLang(saved)

  /* ------------------------------------------------- scroll reveal */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
    { threshold: 0.12 }
  )
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

  /* --------------------------------------------- release downloads */
  const PICKS = [
    { match: /^Naxlo-Setup-.*\.exe$/, icon: '🪟', fa: 'ویندوز — نسخهٔ اصلی', en: 'Windows — main edition', sub: { fa: 'نصب‌کنندهٔ Electron + React', en: 'Electron + React installer' } },
    { match: /^Naxlo-Portable-.*\.exe$/, icon: '🧳', fa: 'ویندوز — پرتابل', en: 'Windows — portable', sub: { fa: 'بدون نصب، اجرا از همین پوشه', en: 'No install, run from folder' } },
    { match: /^Naxlo-Rust-Setup-.*\.exe$/, icon: '⚙️', fa: 'ویندوز — نسخهٔ Rust', en: 'Windows — Rust edition', sub: { fa: 'سبک‌تر، با هستهٔ Tauri', en: 'Leaner, Tauri based' } },
    { match: /linux-amd64\.AppImage$/, icon: '🐧', fa: 'لینوکس — AppImage', en: 'Linux — AppImage', sub: { fa: 'اجرا بدون نصب', en: 'Run without installing' } },
    { match: /linux-amd64\.deb$/, icon: '📦', fa: 'لینوکس — DEB', en: 'Linux — DEB', sub: { fa: 'دبیان و اوبونتو', en: 'Debian & Ubuntu' } },
    { match: /macos-.*\.dmg$/, icon: '🍎', fa: 'مک — DMG', en: 'macOS — DMG', sub: { fa: 'Apple Silicon', en: 'Apple Silicon' } },
    { match: /android-.*-unsigned\.apk$/, icon: '🤖', fa: 'اندروید — APK', en: 'Android — APK', sub: { fa: 'کلاینت بومی Kotlin', en: 'Native Kotlin client' } }
  ]

  const fmtSize = (n) => (n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB')

  function renderDownloads() {
    const grid = document.getElementById('dl-grid')
    const metaEl = document.getElementById('dl-version')
    if (!grid || !releaseCache) return
    const lang = document.documentElement.lang === 'en' ? 'en' : 'fa'
    grid.innerHTML = ''
    for (const pick of PICKS) {
      const asset = releaseCache.assets.find((a) => pick.match.test(a.name))
      if (!asset) continue
      const a = document.createElement('a')
      a.className = 'dl reveal in'
      a.href = asset.browser_download_url
      a.target = '_blank'
      a.rel = 'noopener'
      a.innerHTML =
        '<span class="pico">' + pick.icon + '</span><span><b></b><span></span></span><span class="size">' +
        fmtSize(asset.size) + '</span>'
      a.querySelector('b').textContent = pick[lang]
      a.querySelectorAll('span span')[0].textContent = pick.sub[lang]
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
        mbEl.textContent = (total / 1048576).toFixed(2) + ' MB'
        secEl.textContent = (ms / 1000).toFixed(1) + ' s'
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
        if (sizeEl) sizeEl.textContent = sizeMb + ' MB × ' + SPEED.STREAMS

        total = 0
        const started = performance.now()
        const deadline = started + SPEED.MAIN_MS
        let ramp = 0
        let rampTaken = false
        const rampTimer = setTimeout(() => { ramp = total; rampTaken = true }, SPEED.RAMP_MS)
        const live = setInterval(() => {
          const ms = performance.now() - started
          const mbps = ms > 300 ? steadyMbps(total, rampTaken ? ramp : 0, Math.max(ms, SPEED.RAMP_MS + 200)) : 0
          gauge.textContent = mbps.toFixed(1)
          setArc(mbps)
          bar.style.width = Math.min((mbps / scale) * 100, 100) + '%'
          mbEl.textContent = (total / 1048576).toFixed(2) + ' MB'
          secEl.textContent = (ms / 1000).toFixed(1) + ' s'
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
        gauge.textContent = mbps.toFixed(1)
        setArc(mbps)
        bar.style.width = Math.min((mbps / scale) * 100, 100) + '%'
        break
      }
      clearInterval(tick)
      if (final) {
        log.textContent = (lang() === 'fa'
          ? 'پایان — حجم ' + final.sizeMb + ' مگابایت با ' + SPEED.STREAMS + ' جریان هم‌زمان'
          : 'Done — ' + final.sizeMb + ' MB over ' + SPEED.STREAMS + ' parallel streams')
      } else {
        log.textContent = EN.st_fail
      }
      running = false
      btn.disabled = false
      btn.textContent = EN.st_again
    })
  }
})()
