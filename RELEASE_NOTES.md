# Naxlo 1.8.0 — bug-hunt + new brand identity 🎯

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هستهٔ رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## ✨ تازه‌ها / What's new

### 🎨 هویت بصری جدید / New brand identity
- **نشان «تونل» بازطراحی شد:** N هندسی به‌شکل پرتوی نور میان دو گره، حلقه‌های هم‌مرکز دقیق و کاشی تقریباً مشکی با عمق و نورپردازی مهارشده — حرفه‌ای‌تر، متوازن‌تر و خوانا در ۱۶ پیکسل.
- **The mark was redrawn:** a geometric N as a light beam between two nodes, exactly concentric orbit rings and a near-black tile with restrained lighting — more professional, balanced, and legible at 16 px.
- همهٔ artefactها از یک master SVG (`build/icon-source.svg`) با `scripts/make-icons.mjs` ساخته می‌شوند: آیکون نصب و taskbar، tray، **favicon جدید**، بنر گیت‌هاب و آییکون adaptive اندروید.
- Every artefact renders from one SVG master via `scripts/make-icons.mjs`: installer/taskbar icon, tray icon, **a new favicon**, the GitHub banner and the Android adaptive icon.
- صفحهٔ بوت برندشده (نشان + wordmark + نوار پیشرفت) و عنوان پنجره بر اساس صفحهٔ فعال. / Branded boot screen (mark + wordmark + progress shimmer) and per-page window titles.

### 🐞 باگ‌گیری نسخهٔ الکترون / Electron bug-hunt
- **به‌روزرسانی خودکار اشتراک هرگز اجرا نمی‌شد** (بررسی فیلد legacy تک‌اشتراکی) — حالا واقعاً کار می‌کند. / **Subscription auto-refresh never ran** (legacy single-URL field check) — it actually works now.
- **فیلتر چیپ‌های کشور اعمال نمی‌شد.** / **The country-chip filter never applied.**
- **قطع اتصال هنگام اتصال در جریان** دیگر تونل zombie یا پروکسی سیستمِ باقی‌مانده نمی‌سازد؛ هر اتصال با توکن نسل لغو می‌شود و پروکسی سیستم در همهٔ نقاط انتظار rollback می‌شود. / **Disconnecting mid-connect** no longer leaves a zombie tunnel or leftover system proxy; connects are generation-tokened and roll the proxy back at every await point.
- حذف/پاک‌کردن سرورها هنگام اتصال، اول قطع می‌کند و انتخاب به سرور پشتیبانی‌شدهٔ بعدی می‌رود. / Removing/clearing servers while connected disconnects first and re-selects the next supported server.
- `window.open` رندرر پشت همان allowlist لینک‌های خارجی؛ بازگردانی پروکسی، PAC کاربر را هم برمی‌گرداند؛ تلاش مجدد updater محدود به ۳ بار؛ میان‌برهای Ctrl+1..6 هنگام تایپ غیرفعال. / Renderer `window.open` behind the same external-link allowlist; proxy restore returns the user's PAC; updater retries capped at 3; Ctrl+1..6 shortcuts inert while typing.
- نشان تعداد نتایج هنگام فیلتر/جست‌وجوی سرورها. / Result-count badge while filtering/searching servers.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
| --- | --- |
| `Naxlo-Setup-1.8.0.exe` | نصب‌کنندهٔ ویندوز (NSIS) / Windows installer |
| `Naxlo-Portable-1.8.0.exe` | نسخهٔ قابل‌حمل ویندوز / Windows portable |
| `Naxlo-Rust-Setup-1.8.0.exe` | نسخهٔ Rust/Tauri ویندوز / Rust edition, Windows |
| `Naxlo-Rust-v1.8.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.8.0-macos-arm64.dmg` | مک (Apple Silicon، بدون امضا — راهنمای Gatekeeper در README) / macOS (unsigned, Gatekeeper guide in README) |
| `Naxlo-android-v1.8.0-*.apk` | اندروید / Android |

همهٔ فایل‌ها با `.sha256` / `SHA256SUMS.txt` منتشر شده‌اند؛ به‌روزرسانی خودکار برنامه پس از دانلود، با یک‌بار بسته‌شدن و باز شدن مجدد نصب می‌شود. / Every asset ships with checksums; the silent self-update installs after one restart.

> macOS (unsigned): `xattr -cr /Applications/naxlo.app` سپس اجرا کنید. / then open the app.
