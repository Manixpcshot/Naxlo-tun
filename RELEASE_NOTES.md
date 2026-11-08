# Naxlo 1.13.0 — tools page, live changelog, consistent digits & mobile fix 🧰

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هسته رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## 🧰 صفحهٔ ابزارها / Tools page — vpn.naxlo.ir/tools.html

- **اعتبارسنج کانفیگ، کاملاً در مرورگر:** لینک `vless/vmess/trojan/ss` را بچسبانید؛ همان قاعده‌های پارسر خود اپ اجرا می‌شود (UUID، پورت، network ناشناخته، **pbk برای REALITY**، SNI، serviceName برای gRPC، flow پیشنهادی) و فیلدهای پارشده **پوشیده** نمایش داده می‌شوند — هیچ لینکی آپلود نمی‌شود.
- **Config validator, fully in the browser:** paste a `vless/vmess/trojan/ss` link; the app's own parse rules run (UUID, port, unknown network, **REALITY pbk**, SNI, gRPC serviceName, recommended flow) and parsed fields render **masked** — nothing is uploaded.
- **لینک ↔ QR:** از هر لینک کانفیگ/اشتراک QR بسازید تا با موبایل اسکن شود؛ یا تصویر QR بدهید تا متنش خوانده و مستقیم به اعتبارسنج فرستاده شود. / **Link ↔ QR:** build a QR from any config/subscription link for phone scanning, or feed a QR image to read its text straight into the validator.

## 📰 صفحهٔ تغییرات زنده / Live changelog — vpn.naxlo.ir/changelog.html

- تاریخچهٔ انتشارها مستقیم از API گیت‌هاب + نوار وضعیت بیلد سه ورک‌فلو (Release / Android / tauri) روی آخرین تگ. / Release history straight from the GitHub API + a build-status strip for the three workflows on the latest tag.

## 🔢 اعداد بالاخره یکدست / Digits finally consistent

- اپ: کاشی‌های آمار دیگر در فارسی/ترکی «1h 2m» لاتین نشان نمی‌دهند (`minutesLabel` جدید + تست regression که ارقام هر سه زبان را قفل می‌کند). / App: stats tiles no longer show Latin "1h 2m" in Persian/Turkish (new `minutesLabel` + a regression test locking all three languages' digits).
- وب‌سایت: حالت فارسی اعداد لاتین داشت (حجم کارت‌ها، گیج، MB/ثانیه) که فارسی شد؛ EN کاملاً لاتین می‌ماند. / Website: fa mode had Latin digits (card sizes, gauge, MB/seconds) which now localise; EN stays fully Latin.

## 📱 رسپانسیو موبایل / Mobile responsiveness

- منوی همبرگری با پنل کشویی در <۹۴۰px (پیش‌تر ناوبری حذف می‌شد)، مقیاس‌پذیری حلقه‌ها/آیکن هیرو با `min()`، و چیدمان جمع‌وجور <۶۰۰px برای گیج، تونل، کارت‌ها و دکمه‌های تمام‌عرض. / Burger menu with a dropdown panel under 940px (the nav used to vanish), `min()`-scaled hero rings/icon, and a compact sub-600px layout for gauge, tunnel, cards and full-width buttons.

## 🧪 تست‌ها / Tests

- ۳۸ تست smoke + **۹ تست DOM جدید وب‌سایت** (jsdom) داخل `npm test`: کلید زبان، شمارهٔ قدم‌ها، title/meta، اعتبارسنج و fallbackها. / 38 smoke tests + **9 new website DOM tests** (jsdom) inside `npm test`: language switch, step numerals, title/meta, validator and fallbacks.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
|---|---|
| `Naxlo-Setup-1.13.0.exe` | ویندوز — نصب‌کنندهٔ نسخهٔ اصلی / Windows main installer |
| `Naxlo-Portable-1.13.0.exe` | ویندوز — پرتابل / Windows portable |
| `Naxlo-Rust-Setup-1.13.0.exe` | ویندوز — نسخهٔ سبک Rust / Windows lean Rust edition |
| `Naxlo-Rust-v1.13.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.13.0-macos-arm64.dmg` | مک (Apple Silicon) / macOS |
| `Naxlo-android-v1.13.0-debug.apk` / `-unsigned.apk` | اندروید / Android |
| `naxlo-website.zip` | کل وب‌سایت آمادهٔ cPanel (با tools/changelog جدید) / full cPanel-ready site (with the new tools/changelog) |

همهٔ فایل‌ها با `SHA256SUMS.txt` و checksum تکی. / Every asset ships with `SHA256SUMS.txt` plus per-file checksums.

## 🧾 یادداشت‌ها / Notes

- اندروید: versionCode 2103 / versionName 1.13.0. / Android: versionCode 2103 / versionName 1.13.0.
