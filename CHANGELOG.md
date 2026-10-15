# Changelog / تغییرات

All notable changes to Naxlo are documented here. Releases are cut per tag
(`v*`) and every published change ships as its own GitHub release.

The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.1] — 2026-10-15

### Fixed

- **Stylesheet bundle restored.** v1.1.0 shipped `global.css` with a missing
  semicolon after the flags `@import`; CSS parsed the two import lines as one
  broken at-rule and dropped the whole component/layout layer from the bundle,
  so the app rendered unstyled. The import is terminated again and the built
  CSS is verified to contain the layout rules.
- **Country flags now render.** `flags.css` targeted `.flag-xx` classes while
  the `Flag` component emits `data-flag="xx"`; selectors regenerated to match.

### Added

- Regression tests: every `@import` in `global.css` must be semicolon-terminated
  (with `components.css` present), and the flag stylesheet/component selector
  contract is asserted, so this class of breakage fails `npm test` instead of
  shipping.

## [1.1.0] — 2026-10-15

### Added

- **Bilingual interface** — full Persian/English UI with a language switcher in
  the titlebar and Settings; layout flips RTL/LTR and all numbers, dates and
  relative times follow the active locale. Main-process messages (toasts and
  errors) travel as bilingual payloads.
- **Country flags** — flag chips rendered from ISO codes (identity lookup) and
  parsed out of subscription remarks (🇩🇪-style emoji are detected, displayed as
  crisp SVG flags and stripped from the text). 257 countries bundled.
- **Automatic updates** — on launch Naxlo checks the GitHub releases feed,
  downloads the new installer silently (sha512-verified via `latest.yml`),
  then closes once and relaunches on the new version. A Settings toggle
  controls it and an "Install now" action appears when an update is staged.
- **Latency sparkline** — the connected session re-probes every 25 seconds and
  draws an animated history on the Home page.
- GitHub releases now publish `latest.yml` alongside the installers so the
  updater feed exists for every tag.

### Changed

- Window controls (minimize / maximize / close) are pinned to the **right**
  edge of the titlebar in both languages, matching the Windows convention.
- Design polish: noise overlay, refined stat tiles with icon chips, cleaner
  server rows, segmented controls, toast and sidebar refinements.

### Fixed

- Segmented-control indicator now tracks items correctly in RTL and LTR.

## [1.0.0] — 2026-10-15

### Added

- **Subscription pipeline** — save a subscription URL, fetch the TXT payload,
  decode Base64 and parse `vless://` (primary), plus `trojan://` and `vmess://`;
  unknown schemes are surfaced with a reason instead of being dropped.
- **Server list** — RTL list with search, filters (VLESS / REALITY / WebSocket /
  gRPC / fastest), per-server and bulk latency tests, speed sorting, select,
  connect, copy-link (with warning) and remove.
- **Local proxy mode** — Xray core runs as a child process with SOCKS5 and HTTP
  loopback inbounds only. No TUN, no Wintun, no drivers, no admin rights.
- **Windows system proxy** — optional automatic WinINET proxy with backup and
  restore of the previous settings, including crash-time reconciliation at
  startup.
- **Core management** — automatic download of the pinned official Xray-core
  release with SHA-512 verification and extraction; custom executable support;
  update check against the upstream releases.
- **Connection lifecycle** — connect / disconnect / refresh subscription
  actions, animated status, real traffic verification through the proxy, public
  identity lookup, latency, uptime, and error surfacing.
- **Routing modes** — all-proxy, Iran-direct (geosite/geoip) and LAN-direct,
  plus optional ad blocking.
- **Privacy** — encrypted vault (Windows DPAPI via `safeStorage`, AES-256-GCM
  fallback), masked UI values with explicit reveal, redacted logging, `0600`
  config files deleted after use, access logs disabled.
- **UI** — Persian RTL interface with the Vazirmatn variable font, near-black
  theme with a single restrained accent (5 accent choices), animated power
  control, aurora background, frameless window, tray integration and toasts.
- **Packaging** — NSIS installer and portable executable for Windows x64,
  built on GitHub Actions per tag with SHA-256 checksums.
- **Tests** — parser, Xray config builder and log redactor smoke tests runnable
  without Electron (`npm test`).

### Security

- Subscription URLs, credentials and REALITY keys are never written to logs,
  the console or renderer state in clear text.
- External links are restricted to an allow-list; renderer navigation and
  window opening are blocked; strict CSP in place.
