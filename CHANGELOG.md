# Changelog / تغییرات

All notable changes to Naxlo are documented here. Releases are cut per tag
(`v*`) and every published change ships as its own GitHub release.

The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [1.8.0] - 2026-11-01

### Added
- **هویت بصری جدید:** نشان «تونل» بازطراحی شد — N هندسی به‌شکل پرتوی نور میان دو گره، حلقه‌های هم‌مرکز و کاشی تقریباً مشکی با عمق. همهٔ artefactها از یک master SVG ساخته می‌شوند: `scripts/make-icons.mjs` (آیکون نصب/taskbar، tray، favicon جدید، بنر گیت‌هاب و آییکون adaptive اندروید).
- **New brand identity:** the mark was redrawn — a geometric N as a light beam between two nodes on concentric orbit rings, on a near-black tile with real depth. Every artefact now renders from one SVG master via `scripts/make-icons.mjs`: installer/taskbar icon, tray icon, a new favicon, the GitHub banner and the Android adaptive icon.
- صفحهٔ بوت برندشده (نشان + wordmark + نوار پیشرفت)، عنوان پنجره بر اساس صفحهٔ فعال، و نشان تعداد نتایج هنگام فیلتر/جست‌وجوی سرورها. / Branded boot screen (mark + wordmark + progress shimmer), per-page window titles and a result-count badge while filtering servers.

### Fixed
- **به‌روزرسانی خودکار اشتراک هرگز اجرا نمی‌شد:** تایمر، فیلد legacy تک‌اشتراکی (قبل از ۱.۲.۰) را بررسی می‌کرد که در خزانه‌های جدید همیشه null است. / **Subscription auto-refresh never ran:** the timer checked the legacy single-URL field (pre-1.2.0) which is always null in modern vaults.
- **فیلتر چیپ‌های کشور در صفحهٔ سرورها اعمال نمی‌شد** (وابستگی جامانده در useMemo). / **The country-chip filter never applied** (missing memo dependency).
- **قطع اتصال هنگام اتصال در جریان** می‌توانست تونل zombie به‌جا بگذارد یا پروکسی سیستم را خراب کند؛ اکنون هر connect با شناسهٔ نسل لغو می‌شود و در همهٔ نقاط انتظار، پروکسی سیستم هم rollback می‌شود. / **Disconnecting mid-connect** could leave a zombie tunnel or a leftover system proxy; every connect now carries a generation token and rolls the system proxy back at every await point.
- حذف/پاک‌کردن سرورها هنگام اتصال، اول اتصال را قطع می‌کند و انتخاب به اولین سرور پشتیبانی‌شدهٔ بعدی منتقل می‌شود. / Removing or clearing servers while connected disconnects first and moves the selection to the next supported server.
- `window.open` در رندرر حالا از همان allowlist لینک‌های خارجی عبور می‌کند؛ بازگردانی پروکسی سیستم، AutoConfigURL (PAC) کاربر را هم برمی‌گرداند؛ حلقهٔ تلاش مجدد updater به ۳ بار محدود شد؛ در macOS پنجرهٔ بازسازی‌شده دوباره guard بستن و tray می‌گیرد. / Renderer `window.open` now passes through the same external-link allowlist; system-proxy restore also returns the user's AutoConfigURL (PAC); updater error retries are capped at 3; a recreated window on macOS re-attaches the close guard and tray.
- میان‌برهای Ctrl+1..6 دیگر هنگام تایپ در فیلدها شلیک نمی‌شوند. / Ctrl+1..6 shortcuts no longer fire while typing in inputs.

### Changed
- اندروید: versionCode 1800 و versionName 1.8.0؛ پیش‌زمینهٔ آییکون adaptive با نشان جدید هم‌خانواده شد. / Android bumped to versionCode 1800 / versionName 1.8.0 with the adaptive icon foreground redrawn to the new mark.

## [1.7.0] - 2026-11-01

### Added
- **نسخهٔ Rust/Tauri (ویندوز، لینوکس، مک):** همان رابط React روی بک‌اند Rust (Tauri v2، WebView بومی) — اشتراک‌های URL با نام و سهمیه از هدرهای پنل، فهرست سرورها با ماسک کامل، اتصال/قطع پروکسی محلی با هستهٔ رسمی Xray (پین v26.10.31 + اعتبارسنجی digest + دانلود خودکار)، تست تأخیر تکی/گروهی، تست سرعت، انتخاب خودکار بهترین سرور، پروکسی سیستم روی هر سه سیستم‌عامل، خزانهٔ AES-256-GCM، هشدار خروج هنگام اتصال و خطاهای دوزبانه.
- **خروجی‌های چندپلتفرمی:** `Naxlo-Rust-Setup-x.x.x.exe` (ویندوز NSIS)، `Naxlo-Rust-vx.x.x-linux-amd64.AppImage` و `.deb` (لینوکس) و `Naxlo-Rust-vx.x.x-macos-arm64.dmg` (مک، بدون امضا با راهنمای Gatekeeper) — همه با checksum در هر ریلیز.
- **Rust/Tauri edition (Windows, Linux, macOS):** the same React UI on a Rust backend — URL subscriptions with panel name/quota headers, fully masked server list, local-proxy connect/disconnect with the official Xray core (pinned v26.10.31, digest-verified, auto-download), single/batch latency tests, speed test, auto server pick, system-proxy integration on all three OSes, AES-256-GCM vault, the connected-exit warning and bilingual errors. Lean scope for now: TUN mode, tray, auto-start, self-update and file import stay Electron-only.
- CI: workflow جدید `tauri.yml` — کامپایل و تست Rust روی هر push/PR و ساخت AppImage/DEB/EXE/DMG روی هر تگ. / New `tauri.yml` workflow — Rust compile/test checks on every push/PR and AppImage/DEB/EXE/DMG bundles on every tag.

### Changed
- نوار عنوان با `data-tauri-drag-region` در هر دو نسخه کشیده می‌شود؛ کلیدهای TUN/tray/شروع خودکار/به‌روزرسانی/وارد کردن فایل در نسخهٔ Rust پنهان‌اند. / The titlebar drags in both editions; TUN/tray/auto-start/update/file-import controls are hidden in the Rust edition.
- اندروید: versionCode 1700 و versionName 1.7.0 تا نام APKها با تگ یکی بماند. / Android bumped to versionCode 1700 / versionName 1.7.0 so tag-derived APK names match.

## [1.6.0] - 2026-10-31

### Added
- **حالت TUN کل‌سیستمی (اختیاری، ویندوز):** در «تنظیمات → پروکسی محلی» می‌توان حالت اتصال را بین «پروکسی» (پیش‌فرض، بدون درایور) و «TUN» جابه‌جا کرد. حالت TUN از **اینباند TUN داخلی خود Xray** استفاده می‌کند (بدون فرایند جانبی) و کل ترافیک سیستم — حتی برنامه‌هایی که پروکسی ویندوز را نادیده می‌گیرند (UWP و…) — از تونل عبور می‌کند. درایور رسمی **Wintun 0.14.1** خودکار دانلود و با **SHA-256 پین‌شده** اعتبارسنجی می‌شود؛ فقط یک‌بار تأیید UAC لازم است و برنامه پس از باز شدن مجدد، خودکار متصل می‌شود. هنگام قطع، آداپتور و روت‌های سیستم پاک می‌شوند.
- **هشدار خروج هنگام اتصال (دسکتاپ + اندروید):** بستن برنامه در حالت اتصال دیگر خاموش نیست؛ هشدار سه‌گزینه‌ای: «خاموش کن و ببند» (قطع اتصال سپس خروج)، «متصل بمان و ببند» (دسکتاپ: رفتن به tray؛ اندروید: ماندن تونل و بسته شدن رابط) و «لغو».
- **System-wide TUN mode (optional, Windows):** a Proxy/TUN connection-mode switch in Settings. TUN uses Xray's built-in TUN inbound (no sidecar), routes the entire system through the tunnel, fetches the official Wintun 0.14.1 driver with pinned SHA-256 verification, and needs a one-time UAC elevation with auto-connect afterwards.
- **Exit warning while connected (desktop + Android):** "Disconnect and close", "Stay connected and close" or "Cancel".

### Changed
- هستهٔ پین‌شدهٔ Xray از v26.3.27 به **v26.10.31** ارتقا یافت (شامل رفع امنیتی MPTCP). / The pinned Xray core moved from v26.3.27 to **v26.10.31** (includes the MPTCP security fix).

## [1.5.0] - 2026-10-15

### Added
- **Password-protected file imports (desktop + Android):** subscription files can now be imported from disk — `txt/json/conf/sub` (raw or Base64) and ZIP archives. Encrypted ZIPs prompt for a password: on Windows the classic ZipCrypto algorithm is implemented directly in `fileImport.ts` (no new native deps, fully unit-tested round-trip); on Android `zip4j` handles both ZipCrypto and AES archives.
- Imported files become first-class subscriptions: they appear in the subscription list with a file badge, keep their name, and can be **refreshed** — the stored password (encrypted vault / EncryptedSharedPreferences) means the prompt appears only once.
- Desktop: file-password modal on the Subscription page with wrong-password feedback; file paths and passwords are registered with the log redactor.
- Android: "Add from file" button (SAF document picker, persisted read permission) + password dialog; new trilingual strings.

### Changed
- Desktop refresh of a file subscription re-reads the file from disk instead of fetching a URL; `reveal` on a file subscription shows its path.

## [1.4.1] - 2026-10-15

### Fixed
- Android: launch crash on devices — `MainActivity` (AppCompatActivity) now uses an AppCompat theme (`Theme.AppCompat.NoActionBar`); app start-up is additionally hardened (Keystore/locale failures can no longer kill the process).
- Desktop: self-update never opens the browser anymore — the web-installer fallback is disabled, the manual "check for update" button now starts the silent download → verify → install pipeline, and the installer runs silently so the app restarts exactly once.
- Desktop: a failed update check/download retries automatically after 45 s.

## [1.4.0] — 2026-10-15

### Added

- **Naxlo for Android** — a native Kotlin client in `android/`:
  - VpnService-based tunnel (no root, no system driver) powered by the
    gomobile-bound Xray core (`libv2ray.aar`), same VLESS/REALITY/WebSocket/
    gRPC support as the desktop config builder.
  - Subscription import with Base64 TXT decoding, `subscription-userinfo`
    quota bars and `profile-title` names, per-country-free server list with
    pins and latency tests.
  - Trilingual UI (fa/en/tr) with the desktop's near-black design language.
  - Encrypted vault (Android Keystore) for links and credentials; nothing
    sensitive reaches logs.
  - CI builds the APK on GitHub Actions and attaches debug/unsigned release
    APKs to every tagged release next to the Windows installers.

## [1.3.0] — 2026-10-15

### Added

- **Turkish interface** — the third language (fa → en → tr). The titlebar
  button cycles through all three; Settings shows a three-way choice. Numbers,
  dates and relative times follow the Turkish locale.
- **Auto — best server** — a dashed "Auto" entry at the top of the server list
  lets Naxlo pick the fastest healthy server at connect time.
- **Auto-switch on failure** — when the active server fails three latency
  probes in a row, Naxlo moves to the next best server and says so in a toast
  (toggle in Settings → Behaviour).
- **Pinned servers** — pin any server to keep it at the top of its group, plus
  a "Pinned" filter chip.
- **Country filter chips** — flag chips with per-country counts above the
  server list filter by country.
- **Panic disconnect** — one button (Home) or the global hotkey `Ctrl+Alt+Q`:
  instant disconnect, system proxy force-restored, warning toast.
- **Localized tray** — tray menu and tooltip follow the app language instead
  of being Persian-only.

### Fixed

- **Locale leakage** — durations, relative times and latency values no longer
  fall back to Persian digits/text when English (or Turkish) is active; the
  whole formatting layer is now driven by a per-language locale table.

### Tests

- `pickBestServer` ordering rules covered (19 tests).

## [1.2.0] — 2026-10-15

### Added

- **Multiple subscriptions** — store several subscription links side by side;
  each keeps its own server list, quota and title. The Servers page groups
  configs under their subscription (sticky group headers with counts, quota
  and a per-subscription refresh button); removing one subscription leaves the
  others untouched. Vaults from older versions migrate automatically.
- **Subscription quota panel (Happ-style)** — the standard
  `subscription-userinfo` response header (`upload/download/total/expire`) is
  parsed and shown as a usage bar with used / remaining / total traffic and an
  expiry countdown (days left, expired state), both on the Subscription page
  and on Home for the active subscription.
- **Subscription names from the service** — the `profile-title` response
  header (plain, url-encoded or `base64:`) becomes the subscription's name.
- **Speed test** — a real download-throughput measurement (Mbps) through the
  active local proxy, on the Home quota card.

### Changed

- Servers page header counts now aggregate all subscriptions plus manual
  imports; the sidebar badge does the same.

### Tests

- `subscription-userinfo` and `profile-title` parsers covered (18 tests).

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
