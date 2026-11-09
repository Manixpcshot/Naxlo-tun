# Naxlo 1.14.0 — English button placement, smarter website 🧭

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هسته رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## 🖱️ جای دکمه‌ها در انگلیسی / Button placement in English

- در دیالوگ‌ها ترتیب «عمل اصلی، لغو» در فارسی عمل اصلی را راست‌چین می‌کرد، ولی در انگلیسی/ترکی همان ترتیب دکمهٔ اصلی را چپ‌ترین و گروه را به لبهٔ چپ می‌چسباند. حالا در LTR ردیف معکوس است: **لغو چپ، عمل اصلی راست‌ترین و گروه راست‌چین** — جای دکمهٔ اصلی در هر دو زبان یک طرف فیزیکی می‌ماند.
- Dialogs are authored "primary, cancel"; RTL packed the primary at the right edge while LTR left it leftmost, glued to the left edge. LTR now reverses the row: **Cancel on the left, primary rightmost, group right-aligned** — the primary action keeps the same physical side in every language.
- ردیف‌های دکمه هم‌تراز شدند (`align-items: center`) تا با برچسب‌های بلند انگلیسی نامرتب نشوند. / Button rows are centre-aligned so longer English labels stay tidy.

## 🌐 وب‌سایت بهتر / A better website

- **تشخیص سیستم شما:** کارت دانلود مناسب سیستم‌عامل شما اول می‌آید با برچسب «برای سیستم شما / For your system» و هالهٔ تأکیدی؛ دکمهٔ اصلی هیرو هم همان پلتفرم را می‌گوید. / **Your platform first:** the matching download card leads with a "For your system" badge and accent glow, and the hero CTA names that platform.
- **اعداد فارسی کامل:** جداکنندهٔ اعشاری هم فارسی شد — «۲۰٫۰ MB» به‌جای «۲۰.۰ MB»، دقیقاً مثل اپ. / **Fully Persian numbers:** the decimal separator localises too — «۲۰٫۰ MB» instead of «۲۰.۰ MB», exactly like the app.
- **صفحهٔ تغییرات زنده‌تر:** هر انتشار دکمهٔ دانلود و یادداشت انتشار دارد، چیپ‌های بیلد وضعیت را با کلمهٔ بومی‌شده می‌گویند (موفق/ناموفق/در حال اجرا) و کارت‌ها با تعویض زبان باز-برچسب می‌خورند (پیش‌تر فارسی می‌ماندند). / **Livelier changelog:** every release gained download and notes buttons, build chips spell out their state per language, and the cards relabel on language switch (they used to stay Persian).
- **ابزارها:** اعتبارسنج با **Ctrl+Enter** هم اجرا می‌شود؛ کنار QR دکمه‌های **کپی لینک** و **دانلود QR** اضافه شد. / **Tools:** the validator also runs on **Ctrl+Enter**; the QR card gained **Copy link** and **Download QR**.
- **دسترس‌پذیری و ناوبری:** لینک فعال در منو (`aria-current`)، دکمهٔ بازگشت به بالا، لینک پرش به محتوا. / **A11y & navigation:** active nav link, back-to-top button, skip-to-content link.
- **cPanel:** هدر HSTS، آدرس‌های بدون پسوند (`/tools`، `/changelog`، `/speedtest`) و sitemap به‌روز. / **cPanel:** HSTS header, extensionless URLs and an updated sitemap.

## 🧪 تست‌ها / Tests

- **۱۸ تست DOM وب‌سایت** (jsdom + fetch ساختگی GitHub): گرید دانلود، اولویت سیستم بازدیدکننده، بومی‌سازی اندازه‌ها و اعشار، CTA، بازگشت به بالا، ناوبری فعال، Ctrl+Enter، رندر تغییرات و چیپ‌ها، و قفل sitemap/.htaccess/قاعدهٔ LTR دیالوگ — به‌همراه ۳۸ تست smoke.
- **18 website DOM tests** (jsdom + a stubbed GitHub fetch) covering the download grid, visitor-OS ordering, size/decimal localisation, CTA, back-to-top, active nav, Ctrl+Enter, changelog rendering and chips, plus locks on sitemap/.htaccess/the LTR dialog rule — alongside 38 smoke tests.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
|---|---|
| `Naxlo-Setup-1.14.0.exe` | ویندوز — نصب‌کنندهٔ نسخهٔ اصلی / Windows main installer |
| `Naxlo-Portable-1.14.0.exe` | ویندوز — پرتابل / Windows portable |
| `Naxlo-Rust-Setup-1.14.0.exe` | ویندوز — نسخهٔ سبک Rust / Windows lean Rust edition |
| `Naxlo-Rust-v1.14.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.14.0-macos-arm64.dmg` | مک (Apple Silicon) / macOS |
| `Naxlo-android-v1.14.0-debug.apk` / `-unsigned.apk` | اندروید / Android |
| `naxlo-website.zip` | کل وب‌سایت آمادهٔ cPanel / full cPanel-ready website |

همهٔ فایل‌ها با `SHA256SUMS.txt` و checksum تکی. / Every asset ships with `SHA256SUMS.txt` plus per-file checksums.

## 🧾 یادداشت‌ها / Notes

- اندروید: versionCode 2104 / versionName 1.14.0. / Android: versionCode 2104 / versionName 1.14.0.
