# Naxlo 1.10.1 — stats bug-hunt hotfix 🐞

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هستهٔ رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## 🔧 چه چیزی درست شد / What's fixed

### 📊 نمودار آمار و تغییر ساعت تابستانی / Stats chart vs. DST
- سطل‌های روزانهٔ نمودار ۱۴ روزه با گام ثابت ۲۴ ساعته ساخته می‌شدند؛ در منطقه‌های زمانی دارای DST (مثل اروپا/برلین) عبور از تغییر ساعت می‌توانست یک تاریخ را **تکرار یا حذف** کند — کلید تکراری React و دقیقه‌های جابه‌جا. اکنون همهٔ محاسبات تقویمی است و روزهای ۲۳/۲۵ ساعته درست تقسیم می‌شوند.
- Daily buckets used fixed 24h steps; a DST switch inside the 14-day window (e.g. Europe/Berlin) could **duplicate or skip a date** — duplicate React keys and misattributed minutes. All day math is calendar-based now, and 23h/25h days split correctly. A regression test guards consecutive buckets.

### ⏱️ زمان نشست‌ها با crash از بین نمی‌رود / Crash-safe session time
- نشست باز هر ۲۵ ثانیه با پروب سلامت **heartbeat** می‌گیرد؛ اگر برنامه crash کند یا کشته شود، بازیابیِ هنگام startup نشست را با زمان آخرین heartbeat می‌بندد — به‌جای صفر کردن کل مدت (رفتار ۱.۱۰.۰). در هر دو نسخهٔ Electron و Rust.
- The open session now **heartbeats** every 25s with the health probe; after a crash/kill, startup recovery closes it at the last heartbeat instead of zeroing the whole duration (1.10.0 behaviour). In both the Electron and Rust editions.

### 🇹🇷 ترکی حالا واقعاً نمایش داده می‌شود / Turkish actually renders now
- ترجمه‌های ترکی v1.10.0 در **سه نقطه** گم می‌شدند: `fail()` در IPC الکترون و `normalizeError` در shim تائوری فیلد `tr` را حذف می‌کردند و `pick()` در رندرر منطق قدیمی fa/en را تکرار کرده بود — کاربر ترکی همیشه fallback انگلیسی می‌دید. هر سه درست شد.
- v1.10.0's Turkish translations were lost in **three places**: the Electron IPC `fail()` and the Tauri shim's `normalizeError` dropped the `tr` field, and the renderer's `pick()` duplicated the old fa/en logic — Turkish users always saw the English fallback. All three fixed (pick now delegates to the shared pickL).

### 🎞️ ریزه‌کاری / Minor
- اسپارک‌لاین تاریخچهٔ سرعت در پنجرهٔ باریک از کارت بیرون نمی‌زند. / The speed-history sparkline no longer overflows its card on narrow windows.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
| --- | --- |
| `Naxlo-Setup-1.10.1.exe` | نصب‌کنندهٔ ویندوز (NSIS) / Windows installer |
| `Naxlo-Portable-1.10.1.exe` | نسخهٔ قابل‌حمل ویندوز / Windows portable |
| `Naxlo-Rust-Setup-1.10.1.exe` | نسخهٔ Rust/Tauri ویندوز / Rust edition, Windows |
| `Naxlo-Rust-v1.10.1-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.10.1-macos-arm64.dmg` | مک (Apple Silicon، بدون امضا — راهنمای Gatekeeper در README) / macOS (unsigned, Gatekeeper guide in README) |
| `Naxlo-android-v1.10.1-*.apk` | اندروید / Android |

همهٔ فایل‌ها با `.sha256` / `SHA256SUMS.txt` منتشر شده‌اند؛ به‌روزرسانی خودکار برنامه پس از دانلود، با یک‌بار بسته‌شدن و باز شدن مجدد نصب می‌شود. / Every asset ships with checksums; the silent self-update installs after one restart.

> macOS (unsigned): `xattr -cr /Applications/naxlo.app` سپس اجرا کنید. / then open the app.
