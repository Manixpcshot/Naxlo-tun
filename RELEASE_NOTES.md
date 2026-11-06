# Naxlo 1.9.0 — TUN fixed + Rust edition levels up 🛠️

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هستهٔ رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## ✨ تازه‌ها / What's new

### 🌐 تعمیر حالت TUN کل‌سیستمی / System-wide TUN fixed
- **فایل‌های geo حالا خودکار دانلود می‌شوند:** zip رسمی Xray فاقد `geoip.dat`/`geosite.dat` است و قاعده‌های مسیریابی `geosite:*`/`geoip:*` در حالت TUN هنگام شروع هسته fail می‌شدند؛ naxlo پیش از اجرای هسته این فایل‌ها را از منابع رسمی v2fly می‌گیرد و با `XRAY_LOCATION_ASSET` به هسته می‌دهد.
- **Geo assets now download automatically:** the official Xray zip ships without `geoip.dat`/`geosite.dat`, so TUN routing rules (`geosite:*`/`geoip:*`) hard-failed at core startup; naxlo fetches them from the official v2fly releases before spawning the core and exposes them via `XRAY_LOCATION_ASSET`.
- **نشت DNS بسته شد:** `autoSystemWfpBlockLeak: ["dns"]` (ویندوز) ترافیک `udp/53`، `tcp/53`، WinDNS و DoT بیرون از تونل را با فیلتر WFP مسدود می‌کند. / **The DNS leak is closed:** `autoSystemWfpBlockLeak: ["dns"]` (Windows) blocks `udp/53`, `tcp/53`, the WinDNS client and DoT from escaping the tunnel via WFP filters.
- **خاموش‌شدن graceful هسته:** `taskkill /T` بدون `/F` + انتظار خروج واقعی، تا آداپتور Wintun و روت‌های سیستم درست پاک شوند. / **Graceful core shutdown:** `taskkill /T` without `/F` plus a real exit wait so the Wintun adapter and system routes clean up properly.
- **UAC بدون بن‌بست:** قفل single-instance قبل از relaunch elevated آزاد می‌شود و اگر UAC را رد کنید، برنامه باز می‌ماند و حالت اتصال به «پروکسی» برمی‌گردد. / **UAC without dead ends:** the single-instance lock is released before the elevated relaunch, and denying UAC keeps the app open and rolls the mode back to proxy.
- تغییر حالت پروکسی ⇄ TUN هنگام اتصال، اتصال را در حالت جدید برقرار می‌کند؛ failover اول قطع می‌کند بعد به سرور بعدی می‌رود. / Switching proxy ⇄ TUN while connected reconnects in the new mode; failover disconnects before moving to the next server.

### 🦀 نسخهٔ Rust کامل‌تر شد / The Rust edition levels up
- **tray سیستم:** وضعیت زندهٔ اتصال، اتصال/قطع سریع، باز کردن پنجره و خروج با همان guard هشدار؛ با «کوچک‌شدن به tray» بستن پنجره برنامه را در tray نگه می‌دارد. / **System tray:** live connection status, quick connect/disconnect, open and a guarded quit; with minimize-to-tray on, closing the window parks the app in the tray.
- **شروع خودکار با سیستم‌عامل** روی هر سه پلتفرم (ویندوز/لینوکس/مک). / **OS auto-start** on all three platforms.
- **وارد کردن فایل کانفیگ** — `txt/json/conf/sub` خام یا Base64 و ZIP شامل **آرشیوهای رمزدار** (ZipCrypto/AES) با مودال رمز و ذخیرهٔ امن در vault. / **Config file import** — raw/base64 `txt/json/conf/sub` and ZIP archives including **password-protected** ones (ZipCrypto/AES), with the password modal and secure vault storage.
- **failover خودکار:** پس از سه بار شکست پروب سلامت، بهترین سرور جایگزین انتخاب و اتصال جابه‌جا می‌شود. / **Auto-failover:** after three failed health probes the best alternative server takes over.
- انتخاب دستی فایل اجرایی هسته (با اعتبارسنجی `xray version`) و parity قطع اتصال هنگام حذف/پاک‌کردن سرورها. / Manual core-binary picking (validated with `xray version`) and disconnect parity when removing/clearing servers.

### 🎞️ صیقل انیمیشن‌ها / Animation polish
- shimmer فقط `background-position` انیمیت می‌کند؛ درخشش نوار پیشرفت کلیدهای `sweep`/`sweep-rtl` جدا گرفت؛ indeterminate و اسلاید بوت در RTL درست معکوس می‌شوند؛ اکولایزر از پایین مقیاس می‌شود؛ «کاهش حرکت» حالا واقعاً همه‌چیز را ساکن می‌کند؛ تعویض صفحه اسکرول را ریست می‌کند.
- Shimmer animates `background-position` only; the progress sheen got dedicated `sweep`/`sweep-rtl` keyframes; indeterminate progress and the boot slide mirror correctly in RTL; equalizer bars scale from the bottom; reduce-motion now truly silences motion; page switches reset the scroll position.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
| --- | --- |
| `Naxlo-Setup-1.9.0.exe` | نصب‌کنندهٔ ویندوز (NSIS) / Windows installer |
| `Naxlo-Portable-1.9.0.exe` | نسخهٔ قابل‌حمل ویندوز / Windows portable |
| `Naxlo-Rust-Setup-1.9.0.exe` | نسخهٔ Rust/Tauri ویندوز / Rust edition, Windows |
| `Naxlo-Rust-v1.9.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.9.0-macos-arm64.dmg` | مک (Apple Silicon، بدون امضا — راهنمای Gatekeeper در README) / macOS (unsigned, Gatekeeper guide in README) |
| `Naxlo-android-v1.9.0-*.apk` | اندروید / Android |

همهٔ فایل‌ها با `.sha256` / `SHA256SUMS.txt` منتشر شده‌اند؛ به‌روزرسانی خودکار برنامه پس از دانلود، با یک‌بار بسته‌شدن و باز شدن مجدد نصب می‌شود. / Every asset ships with checksums; the silent self-update installs after one restart.

> macOS (unsigned): `xattr -cr /Applications/naxlo.app` سپس اجرا کنید. / then open the app.
