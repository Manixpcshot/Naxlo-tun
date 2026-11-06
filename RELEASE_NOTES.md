# Naxlo 1.11.1 — English mode is fully English 🇬

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هسته رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## 🧹 پاک‌سازی رابط انگلیسی / English-mode cleanup

### اپ دسکتاپ / Desktop app
- دو رشتهٔ فارسیِ سخت‌کد در رابط انگلیسی/ترکی پیدا و درست شدند: tooltip «نمایش مقدار واقعی / پنهان کردن» روی مقدارهای پوشیده و عنوان پیش‌فرض توست خطا («خطا»). هر دو اکنون از دیکشنری سه‌زبانه می‌آیند؛ کلیدهای `reveal`/`hide` ترجمهٔ ترکی هم گرفتند.
- Two hard-coded Persian strings leaked into the English/Turkish UI: the reveal/hide tooltip on masked values and the default error-toast title («خطا»). Both now come from the trilingual dictionary; `reveal`/`hide` gained Turkish translations.

### وب‌سایت / Website (vpn.naxlo.ir)
- در حالت انگلیسی، شمارهٔ قدم‌ها (۱/۲/۳)، کل صفحهٔ ۴۰۴ و عنوان/meta/OG تگ‌ها فارسی می‌ماندند؛ اکنون همه با زبان عوض می‌شوند: شماره‌ها کلید i18n گرفتند، صفحهٔ ۴۰۴ دوزبانه شد (با کلید زبان) و `title`/`meta description`/`og:*` هر سه صفحه با دیکشنری جابه‌جا می‌شوند.
- In EN mode the step numerals (۱/۲/۳), the entire 404 page and the title/meta/OG tags stayed Persian; everything now switches with the language: numerals got i18n keys, the 404 page is bilingual (with the language switch) and `title`/`meta description`/`og:*` on all three pages come from the dictionary.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
|---|---|
| `Naxlo-Setup-1.11.1.exe` | ویندوز — نصب‌کنندهٔ نسخهٔ اصلی / Windows main installer |
| `Naxlo-Portable-1.11.1.exe` | ویندوز — پرتابل / Windows portable |
| `Naxlo-Rust-Setup-1.11.1.exe` | ویندوز — نسخهٔ سبک Rust / Windows lean Rust edition |
| `Naxlo-Rust-v1.11.1-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.11.1-macos-arm64.dmg` | مک (Apple Silicon) / macOS |
| `Naxlo-android-v1.11.1-debug.apk` / `-unsigned.apk` | اندروید / Android |
| `naxlo-website.zip` | کل وب‌سایت آمادهٔ cPanel / full cPanel-ready website |

همهٔ فایل‌ها با `SHA256SUMS.txt` و checksum تکی. / Every asset ships with `SHA256SUMS.txt` plus per-file checksums.

## 🧾 یادداشت‌ها / Notes

- اندروید: versionCode 2101 / versionName 1.11.1. / Android: versionCode 2101 / versionName 1.11.1.
- ۳۴ تست smoke سبز؛ typecheck و بیلد هر دو نسخه سبز. / 34 smoke tests green; typecheck and both edition builds green.
