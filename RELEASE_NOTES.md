# Naxlo 1.11.0 — website, working speed test & healed TUN 🌐

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هسته رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## 🌐 وب‌سایت رسمی / Official website — vpn.naxlo.ir

- سایت استاتیک آمادهٔ **cPanel** هم‌طراح با اپ: تقریباً مشکی با یک تأکید فیروزه‌ای، وزیرمتن، راست‌به‌چپ، کلید زبان فا/EN، انیمیشن‌های نرم، favicon و آیکن‌های PWA/OG.
- کارت‌های دانلود **خودکار** از API انتشارهای گیت‌هاب پر می‌شوند — همیشه آخرین نسخه با حجم فایل‌ها، بدون نیاز به ویرایش سایت.
- صفحهٔ **تست سرعت در مرورگر** (`/speedtest.html`) با گیج زنده؛ اگر اپ متصل باشد، خود تونل سنجیده می‌شود.
- فایل اندازه‌گیری `/speedtest.bin` (۱۰ مگابایت تصادفی) که **خود اپ‌ها** هم برای تست سرعت از آن استفاده می‌کنند؛ طبق `.htaccess` هرگز فشرده یا کش نمی‌شود.
- راهنمای استقرار: `website/README.md` — زیپ آمادهٔ `naxlo-website.zip` را در document root ساب‌دامین extract کنید و AutoSSL را بزنید.
- A cPanel-ready static site in the app's own design language: near-black with one cyan accent, Vazirmatn, RTL, fa/EN switch, soft animations, favicon + PWA/OG icons. Download cards auto-fill from the GitHub releases API (always the latest assets + sizes). `/speedtest.html` runs a live in-browser test, and `/speedtest.bin` (10 MB random, never compressed/cached per `.htaccess`) is the very file the apps measure through the tunnel. Deploy guide: `website/README.md`.

## ⚡ تست سرعت درست شد / Speed test fixed

- هدف‌های قدیمی در بسیاری از مسیرها مرده یا مسدود بودند (`proof.ovh.net` سال‌هاست خاموش است) و تست فقط خطا می‌داد.
- ترتیب جدید در هر دو نسخهٔ Electron و Rust: **۱)** فایل خود پروژه `vpn.naxlo.ir/speedtest.bin` (با query ضد‌کش) **۲)** Cloudflare **۳)** آینهٔ tele2.
- The old targets were dead or blocked on many routes (`proof.ovh.net` has been down for years), so the test only ever errored. New order in both editions: the project's own file first (cache-busted), then Cloudflare, then a tele2 mirror.

## 🩹 حالت TUN درمان شد / TUN healed

- نشانهٔ کلاسیک «متصل است ولی هیچ چیز باز نمی‌شود»: پرس‌وجوهای DNS که فیلترهای WFP به تونل هل می‌دهند با قاعدهٔ catch-all به forwarder سرور می‌رفتند و بسیاری سرورها UDP:53 را بی‌صدا دور می‌اندازند.
- اکنون یک outbound از نوع `dns` + قاعدهٔ پورت ۵۳ از اینباند TUN، پاسخ‌ها را **داخل خود Xray** می‌سازد — DoH رمزنگاری‌شده که از داخل پروکسی عبور می‌کند (نشت DNS صفر).
- `queryStrategy: UseIPv4` جواب‌های AAAA را از آداپتر فقط-IPv4 دور نگه می‌دارد؛ دیگر اتصال‌ها روی مسیر دست‌نیافتنی IPv6 هنگ نمی‌کنند.
- The classic "connected but nothing loads" symptom: WFP-filtered DNS queries rode the catch-all rule to the server's UDP forwarder, which many servers silently drop. A `dns` outbound + port-53 rule from the TUN inbound now answers them inside Xray via encrypted DoH through the proxy, and `UseIPv4` keeps AAAA records off the IPv4-only adapter so connections no longer stall.

## 🎨 آیکون جدید پر جزئیات / New detailed icon

- نسخهٔ ۲ نشان: سپر محافظ دور پرتو N، حلقه‌های مداری با ماهواره، صورت‌های فلکی و ذره‌های داده روی پرتو — بازسازی همهٔ artefactها: ico/icns/png، tray، بنر گیت‌هاب، ست تائوری، پیش‌زمینهٔ adaptive اندروید و favicon سایت.
- Mark v2: a protective shield around the N beam, orbit rings with satellites, constellations and data particles — every artefact regenerated (ico/icns/png, tray, GitHub banner, Tauri set, Android adaptive foreground, site favicon).

## 📦 دانلود / Downloads

| فایل / File | برای / For |
|---|---|
| `Naxlo-Setup-1.11.0.exe` | ویندوز — نصب‌کنندهٔ نسخهٔ اصلی / Windows main installer |
| `Naxlo-Portable-1.11.0.exe` | ویندوز — پرتابل / Windows portable |
| `Naxlo-Rust-Setup-1.11.0.exe` | ویندوز — نسخهٔ سبک Rust / Windows lean Rust edition |
| `Naxlo-Rust-v1.11.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.11.0-macos-arm64.dmg` | مک (Apple Silicon، بدون امضا — راهنمای Gatekeeper در README) / macOS |
| `Naxlo-android-v1.11.0-debug.apk` / `-unsigned.apk` | اندروید / Android |

همهٔ فایل‌ها با `SHA256SUMS.txt` و checksum تکی کنارشان. / Every asset ships with `SHA256SUMS.txt` plus per-file checksums.

## 🧾 یادداشت‌ها / Notes

- `naxlo-website.zip` (کل سایت آمادهٔ cPanel) به‌صورت asset روی همین انتشار و همچنین در گوگل‌درایو موجود است. / `naxlo-website.zip` (the full cPanel-ready site) ships as an asset of this release and on Google Drive.
- اندروید: versionCode 2100 / versionName 1.11.0. / Android: versionCode 2100 / versionName 1.11.0.
- تست‌ها: ۳۴ تست smoke سبز (شامل گارانتی‌های جدید کانفیگ TUN/DNS). / 34 smoke tests green (including new TUN/DNS config guarantees).
