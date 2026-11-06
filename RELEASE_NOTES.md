# Naxlo 1.10.0 — stats page, Android tile, full Turkish 📊

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هستهٔ رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## ✨ تازه‌ها / What's new

### 📊 صفحهٔ آمار مصرف / Usage statistics page
- **در هر دو نسخهٔ دسکتاپ (Electron و Rust):** نمودار میله‌ای ۱۴ روزهٔ مدت اتصال، جمع کل، تعداد نشست‌ها، میانگین هر نشست، سرورهای پراستفاده با پرچم کشور و تاریخچهٔ تست سرعت.
- **In both desktop editions:** an animated 14-day connection-time chart, totals, session counts, most-used servers with country flags and the speed-test history.
- نشست‌ها در همان خزانهٔ رمزنگاری‌شده ذخیره می‌شوند — فقط نام سرور و زمان، هرگز آدرس یا اعتبارنامه؛ حتی بعد از crash هم زمان نشست‌ها گم نمی‌شود. / Sessions live in the same encrypted vault — server name and timestamps only, never addresses or credentials; even crashes preserve session time.

### 📱 کاشی Quick Settings اندروید / Android Quick Settings tile
- اتصال/قطع یک‌ضربی تونل از پنل سریع، بدون باز کردن برنامه؛ وضعیت کاشی زنده است و وقتی متصل هستید نام سرور را نشان می‌دهد.
- One-tap tunnel connect/disconnect from the Quick Settings panel without opening the app; the tile state is live and shows the server name while connected.

### 🇹🇷 ترکی کامل / Full Turkish
- پیام‌های سمت main در الکترون و نسخهٔ Rust (`l10n.rs`) حالا سه‌زبانه‌اند: خطاها، toastها، منوی tray و هشدار خروج. کاربران ترکی پیش‌تر fallback انگلیسی می‌دیدند.
- Native messages in both editions are trilingual now: errors, toasts, the tray menu and the exit warning. Turkish users previously fell back to English.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
| --- | --- |
| `Naxlo-Setup-1.10.0.exe` | نصب‌کنندهٔ ویندوز (NSIS) / Windows installer |
| `Naxlo-Portable-1.10.0.exe` | نسخهٔ قابل‌حمل ویندوز / Windows portable |
| `Naxlo-Rust-Setup-1.10.0.exe` | نسخهٔ Rust/Tauri ویندوز / Rust edition, Windows |
| `Naxlo-Rust-v1.10.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.10.0-macos-arm64.dmg` | مک (Apple Silicon، بدون امضا — راهنمای Gatekeeper در README) / macOS (unsigned, Gatekeeper guide in README) |
| `Naxlo-android-v1.10.0-*.apk` | اندروید / Android |

همهٔ فایل‌ها با `.sha256` / `SHA256SUMS.txt` منتشر شده‌اند؛ به‌روزرسانی خودکار برنامه پس از دانلود، با یک‌بار بسته‌شدن و باز شدن مجدد نصب می‌شود. / Every asset ships with checksums; the silent self-update installs after one restart.

> macOS (unsigned): `xattr -cr /Applications/naxlo.app` سپس اجرا کنید. / then open the app.
