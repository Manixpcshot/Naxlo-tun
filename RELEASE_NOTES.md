# Naxlo 1.12.0 — adaptive speed test, speedtest.net-style ⚡

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هسته رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## ⚡ تست سرعت واقعی برای خط‌های قوی / Real numbers for fast lines

مشکل ۱.۱۱: روی خط‌های خیلی قوی، فایل ۱۰ مگابایتی در کسری از ثانیه تمام می‌شد و عدد گزارش‌شده خیلی کمتر از سرعت واقعی بود (رمپ‌آپ TCP + پنجرهٔ کوتاه). حالا measurement مثل speedtest.net سه مرحله‌ای است — در اپ الکترون، نسخهٔ Rust و صفحهٔ وب:

The 1.11 problem: on very fast lines the 10 MB file finished in a fraction of a second and the reported number was far below the real line (TCP slow-start + a too-short window). Measurement is now three-phased like speedtest.net — in the Electron app, the Rust edition and the web page:

1. **پروب / Probe:** یک جریان تک‌اتصاله ۲ مگابایتی (حداکثر ۴ ثانیه) نرخ تقریبی خط را می‌گیرد. / A single-stream 2 MB pull (≤4 s) estimates the line.
2. **حجم پلکانی / Ladder size:** حجم اصلی طوری انتخاب می‌شود که ~۸ ثانیه پر بماند: ۸ / ۱۶ / ۲ / ۶۴ / ۱۰۰ مگابایت. / The main size is picked to fill ~8 s: 8 / 16 / 32 / 64 / 100 MB.
3. **۴ جریان هم‌زمان + نرخ پایدار / 4 parallel streams + steady rate:** چهار اتصال موازی می‌کشند (خط گیگابیت دیگر به یک TCP محدود نمی‌شود) و ۱٫۵ ثانیهٔ اول (رمپ‌آپ) از نرخ نهایی حذف می‌شود. / Four parallel connections pull (a gigabit line is no longer capped by one TCP) and the first 1.5 s (slow-start) is excluded from the final rate.

### منبع‌ها / Sources (به ترتیب / in order)
1. **vpn.naxlo.ir** — فایل استاتیک `speedtest.bin` برای قدم‌های کوچک و مولد جدید `speedtest.php?bytes=N` (تا ۲۵۰ مگابایت، بایت تصادفی فشرده‌ناپذیر، no-store) برای قدم‌های بزرگ. / the static `speedtest.bin` for small steps and the new `speedtest.php?bytes=N` on-demand generator (up to 250 MB, incompressible random bytes, no-store) for big steps.
2. **Cloudflare** — `speed.cloudflare.com/__down?bytes=N` با هر حجمی. / with any size.
3. **tele2** — آینهٔ ثابت ۱۰/۲۰/۵۰/۱۰۰ مگابایت. / fixed 10/20/50/100 MB mirror.

صفحهٔ وب حالا حجم هدف و تعداد جریان را نشان می‌دهد و مقیاس گیج با خط بزرگ می‌شود (تا ۲۰۰۰ مگابیت). / The web page now shows the target size and stream count, and the gauge scale grows with the line (up to 2000 Mbit/s).

## 🧪 تست‌ها / Tests

- ۳۷ تست smoke سبز شامل ۳ تست جدید برای نردبان حجم، نرخ پایدار و انتخاب آینهٔ tele2؛ تست‌های واحد Rust معادل هم اضافه شدند. / 37 smoke tests green including 3 new ones for the size ladder, steady rate and tele2 mirror pick; matching Rust unit tests added.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
|---|---|
| `Naxlo-Setup-1.12.0.exe` | ویندوز — نصب‌کنندهٔ نسخهٔ اصلی / Windows main installer |
| `Naxlo-Portable-1.12.0.exe` | ویندوز — پرتابل / Windows portable |
| `Naxlo-Rust-Setup-1.12.0.exe` | ویندوز — نسخهٔ سبک Rust / Windows lean Rust edition |
| `Naxlo-Rust-v1.12.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.12.0-macos-arm64.dmg` | مک (Apple Silicon) / macOS |
| `Naxlo-android-v1.12.0-debug.apk` / `-unsigned.apk` | اندروید / Android |
| `naxlo-website.zip` | کل وب‌سایت آمادهٔ cPanel (با speedtest.php جدید) / full cPanel-ready site (with the new speedtest.php) |

همهٔ فایل‌ها با `SHA256SUMS.txt` و checksum تکی. / Every asset ships with `SHA256SUMS.txt` plus per-file checksums.

## 🧾 یادداشت‌ها / Notes

- اندروید: versionCode 2102 / versionName 1.12.0. / Android: versionCode 2102 / versionName 1.12.0.
