# Changelog / تغییرات

All notable changes to Naxlo are documented here. Releases are cut per tag
(`v*`) and every published change ships as its own GitHub release.

The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [1.10.1] - 2026-11-06

### Fixed
- **نمودار آمار در تغییر ساعت تابستانی (DST) خراب می‌شد:** سطل‌های روزانه با گام ثابت ۲۴ ساعته ساخته می‌شدند؛ در منطقهٔ زمانی اروپا عبور از تغییر ساعت (۲۵ اکتبر) می‌توانست یک تاریخ را در پنجرهٔ ۱۴ روزه **تکرار یا حذف** کند (کلید تکراری React + دقیقه‌های جابه‌جا). اکنون همهٔ محاسبات روزانه تقویمی است (`setDate`) و روزهای ۲۳/۲۵ ساعته درست حساب می‌شوند؛ یک تست جدید پشت‌بند بودن روزها را گارانتی می‌کند.
- **The stats chart broke across DST:** daily buckets were built with fixed 24h steps, so a daylight-saving switch inside the 14-day window could **duplicate or skip a local date** (duplicate React keys + misattributed minutes). All day math is calendar-based now (`setDate`); 23h/25h days are handled correctly and a new test guarantees consecutive buckets.
- **زمان نشست دیگر با crash از بین نمی‌رود:** نشست باز هر ۲۵ ثانیه با پروب سلامت heartbeat می‌گیرد (`endedAt` به‌روز می‌شود)؛ پس از crash، بازیابی startup نشست را با زمان آخرین heartbeat می‌بندد نه با مدت صفر. (پیش‌تر کل مدت نشستِ crash خورده صفر می‌شد.) / **Session time now survives crashes:** the open session heartbeats every 25s with the health probe; startup recovery closes crashed sessions at their last heartbeat instead of zeroing them.
- **پیام‌های ترکی واقعاً به UI می‌رسند:** `tr` در سه نقطه گم می‌شد — `fail()` در IPC الکترون و `normalizeError` در shim تائوری فیلد را هنگام عبور از مرز فرایند **حذف می‌کردند** و `pick()` در رندرر منطق قدیمی fa/en را تکرار کرده بود؛ در نتیجه ترجمه‌های ترکی v1.10.0 هرگز نمایش داده نمی‌شدند. هر سه درست شدند (`pick` اکنون از `pickL` مشترک استفاده می‌کند). / **Turkish messages actually reach the UI now:** `tr` was lost in three places — the Electron IPC `fail()` and the Tauri shim's `normalizeError` **dropped the field** at the process boundary, and the renderer's `pick()` duplicated the old fa/en logic; v1.10.0's Turkish translations never rendered. All three fixed (`pick` now delegates to the shared `pickL`).
- اسپارک‌لاین تاریخچهٔ سرعت در پنجره‌های باریک از کارت بیرون نمی‌زند (`max-width: 100%`). / The speed-history sparkline no longer overflows its card on narrow windows.

### Changed
- اندروید: versionCode 2001 و versionName 1.10.1. / Android bumped to versionCode 2001 / versionName 1.10.1.

## [1.10.0] - 2026-11-06

### Added
- **صفحهٔ آمار مصرف (هر دو نسخهٔ دسکتاپ):** نمودار میله‌ای ۱۴ روزهٔ مدت اتصال (با تقسیم درست نشست‌های شبانه‌روز)، جمع کل زمان اتصال، تعداد نشست‌ها، میانگین هر نشست، سرورهای پراستفاده با پرچم کشور و نمودار تاریخچهٔ تست سرعت. نشست‌ها از لحظهٔ اتصال در خزانهٔ رمزنگاری‌شده ثبت می‌شوند (فقط نام سرور و زمان — هرگز آدرس یا اعتبارنامه)، با بستن برنامه یا crash هم نشست‌های باز بسته می‌شوند و دکمهٔ «پاک‌کردن آمار» همه‌چیز را صفر می‌کند.
- **کاشی Quick Settings اندروید:** اتصال/قطع یک‌ضربی تونل از پنل سریع اندروید بدون باز کردن برنامه؛ وضعیت کاشی زنده است (متصل = فعال با نام سرور)، و در نبود مجوز VPN یا سرور، برنامه را باز می‌کند.
- **ترکی کامل در پیام‌های بومی:** رشته‌های سمت main در الکترون و `l10n.rs` در نسخهٔ Rust حالا `LString.tr` دارند — خطاها، toastها، منوی tray و هشدار خروج در هر دو نسخه سه‌زبانه‌اند (پیش‌تر کاربران ترکی انگلیسی می‌دیدند). یک تست smoke پوشش ترجمهٔ همهٔ رشته‌های ثابت را گارانتی می‌کند.
- **Usage statistics page (both desktop editions):** an animated 14-day connection-time chart (midnight-spanning sessions split correctly), totals/averages, most-used servers with country flags and a speed-test history sparkline. Sessions are recorded in the encrypted vault at connect time (server name + timestamps only — never addresses or credentials), open sessions are closed after crashes/quits, and a clear button resets everything.
- **Android Quick Settings tile:** one-tap tunnel connect/disconnect without opening the app, with a live tile state (active + server name when connected) and a graceful fallback to the app when the VPN permission or a server is missing.
- **Full Turkish for native messages:** main-process strings (Electron) and `l10n.rs` (Rust) now carry `LString.tr` — errors, toasts, the tray menu and the exit warning are trilingual in both editions (Turkish users previously fell back to English). A smoke test guards the translation coverage.

### Changed
- میان‌برهای Ctrl+1..7 برای هفت صفحه (آمار = Ctrl+4). / Page hotkeys are now Ctrl+1..7 (stats = Ctrl+4).
- اندروید: versionCode 2000 و versionName 1.10.0. / Android bumped to versionCode 2000 / versionName 1.10.0.

## [1.9.0] - 2026-11-06

### Fixed
- **باگ‌های حالت TUN کل‌سیستمی (ویندوز):** فایل‌های geo (`geoip.dat`/`geosite.dat`) که اینباوند TUN با مسیریابی geo به آن‌ها نیاز دارد در zip رسمی Xray وجود ندارند و قاعده‌های `geosite:*`/`geoip:*` هنگام شروع هسته fail می‌شدند؛ اکنون naxlo قبل از اجرای هسته آن‌ها را از منابع رسمی v2fly دانلود، در `userData/xray/assets` ذخیره و با `XRAY_LOCATION_ASSET` به هسته معرفی می‌کند (با بازبینی freshness).
- **System-wide TUN bugs (Windows):** the geo assets (`geoip.dat`/`geosite.dat`) required by TUN routing rules are absent from the official Xray zip, so `geosite:*`/`geoip:*` rules hard-failed at core startup; naxlo now downloads them from the official v2fly releases into `userData/xray/assets` and points the core at them via `XRAY_LOCATION_ASSET` (with a staleness re-check).
- نشت DNS دور‌زنندهٔ تونل در ویندوز بسته شد: `autoSystemWfpBlockLeak: ["dns"]` (فقط ویندوز) ترافیک `udp/53`، `tcp/53`، WinDNS و DoT (`853`) بیرون از تونل را با فیلتر WFP مسدود می‌کند. / The Windows DNS leak around the tunnel is closed: `autoSystemWfpBlockLeak: ["dns"]` (Windows-only) blocks `udp/53`, `tcp/53`, the WinDNS client and DoT (`853`) from escaping the tunnel via WFP filters.
- خاموش‌کردن هسته اکنون graceful است: `taskkill /T` بدون `/F` + انتظار تا خروج واقعی فرایند (و در صورت نیاز kill-tree) تا آداپتور Wintun و روت‌های سیستم تمیز پاک شوند. / Core shutdown is graceful now: `taskkill /T` without `/F` plus a real exit wait (kill-tree only as fallback) so the Wintun adapter and system routes clean up properly.
- ارتقای UAC: قفل single-instance قبل از relaunch elevated آزاد می‌شود (نمونهٔ ادمین دیگر به‌عنوان «نمونهٔ دوم» خارج نمی‌شود)؛ در صورت رد کردن UAC برنامه در حال اجرا می‌ماند و حالت اتصال به «پروکسی» برمی‌گردد. / UAC elevation: the single-instance lock is released before the elevated relaunch (the admin instance no longer quits as a "second instance"); on UAC denial the app stays open and rolls the connection mode back to proxy.
- تغییر حالت اتصال (پروکسی ⇄ TUN) هنگام اتصال فعال، اکنون با یک toast اتصال را در حالت جدید برقرار می‌کند؛ failover قبل از اتصال به سرور بعدی اول قطع می‌کند؛ مسیرهای اتصال خودکار TUN بدون ادمین با هشدار رد می‌شوند. / Switching connection mode (proxy ⇄ TUN) while connected now reconnects in the new mode with a toast; failover disconnects before connecting to the next server; TUN auto-connect paths are skipped with a warning when not elevated.
- **باگ‌گیری انیمیشن‌ها:** shimmer اسکلتون/دکمه‌ها فقط `background-position` را انیمیت می‌کند (بدون پرش رنگ)، درخشش نوار پیشرفت کلید `sweep`/`sweep-rtl` جداگانه گرفت، حالت indeterminate و اسلاید بوت در RTL معکوس می‌شوند، میله‌های اکولایزر از پایین مقیاس می‌شوند، `MotionConfig` با «کاهش حرکت» همهٔ انیمیشن‌های motion را خاموش می‌کند و تعویض صفحه اسکرول را به بالا برمی‌گرداند. / **Animation bug-hunt:** skeleton/button shimmer animates `background-position` only (no color jump), the progress sheen got dedicated `sweep`/`sweep-rtl` keyframes, indeterminate progress and the boot slide mirror correctly in RTL, equalizer bars scale from the bottom, `MotionConfig` fully honors reduce-motion, and page switches reset the scroll position.

### Added
- **نسخهٔ Rust از حالت lean خارج شد:** tray سیستم (وضعیت زنده، اتصال/قطع سریع، باز کردن، خروج با همان guard)، شروع خودکار با OS (پلاگین autostart)، **وارد کردن فایل کانفیگ** با پشتیبانی ZIP رمزدار (ZipCrypto/AES) و مودال رمز در UI، انتخاب دستی فایل اجرایی هسته با اعتبارسنجی، **failover خودکار** پس از سه بار شکست پروب سلامت، بستن پنجره به tray وقتی «کوچک‌شدن به tray» فعال است و parity قطع اتصال هنگام حذف/پاک‌کردن سرورها.
- **The Rust edition outgrows its lean scope:** a system tray (live status, quick connect/disconnect, open, guarded quit), OS auto-start (autostart plugin), **config file import** with password-protected ZIP support (ZipCrypto/AES) and the password modal in the UI, manual core-binary picking with validation, **auto-failover** after three failed health probes, close-to-tray when minimize-to-tray is on, and disconnect parity when removing/clearing servers.
- کلیدهای auto-start، کوچک‌شدن به tray، انتخاب فایل هسته و «وارد کردن از فایل» در نسخهٔ Rust از حالت پنهان خارج شدند. / The auto-start, minimize-to-tray, pick-core-file and import-from-file controls are now enabled in the Rust edition.

### Changed
- TUN و به‌روزرسانی خاموش خودکار همچنان مخصوص نسخهٔ الکترون (ویندوز) باقی می‌مانند. / TUN mode and silent self-update remain Electron-only (Windows).
- اندروید: versionCode 1900 و versionName 1.9.0. / Android bumped to versionCode 1900 / versionName 1.9.0.

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
