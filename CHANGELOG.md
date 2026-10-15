# Changelog / تغییرات

All notable changes to Naxlo are documented here. Releases are cut per tag
(`v*`) and every published change ships as its own GitHub release.

The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

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
