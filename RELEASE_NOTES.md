# Naxlo 1.15.1 — the website worked only on a first visit in English 🩹

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هسته رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## 🐛 باگ اصلی / The main bug

- **سایت برای بازدیدکنندهٔ انگلیسی‌زبانِ بازگشتی از کار می‌افتاد.** هنگام بالاآمدن صفحه، اگر زبان ذخیره‌شده در localStorage برابر `en` بود، `applyLang()` پیش از مقداردهی ثابت‌های هم‌دامنه اجرا می‌شد و `renderReleases()` به `const relRoot` می‌رسید:
  `ReferenceError: Cannot access 'relRoot' before initialization` — و بقیهٔ `app.js` هرگز اجرا نمی‌شد.
- **The website died for returning English visitors.** At boot, when the stored language was `en`, `applyLang()` ran before the consts in its own scope were initialised and `renderReleases()` touched `const relRoot`:
  `ReferenceError: Cannot access 'relRoot' before initialization` — and the rest of `app.js` never ran.
- نتیجه: دکمهٔ پوستهٔ روز/شب، منوی همبرگری موبایل، اعتبارسنج کانفیگ، QR، گرید دانلود و صفحهٔ تغییرات برای کسی که **یک بار** انگلیسی را انتخاب کرده بود کار نمی‌کردند. بار اول (زبان پیش‌فرض فارسی) همه‌چیز درست بود، برای همین دیده نمی‌شد.
- Result: the day/night toggle, the mobile burger menu, the config validator, the QR tools, the download grid and the changelog never wired up for anyone who had picked English **once**. A first visit (default Persian) worked, which is why it went unnoticed.
- اصلاح: بخش boot به انتهای دامنه منتقل شد تا همهٔ ثابت‌ها پیش از اجرای `applyLang()` مقدار گرفته باشند. / Fix: the boot block moved to the end of the scope, so every const exists before `applyLang()` runs.
- این باگ پیش از ۱.۱۵.۰ هم وجود داشت (در `origin/main` بازتولید شد) و فقط در «بازدید مجدد با زبان ذخیره‌شده» ظاهر می‌شد — تست‌های DOM قبلی همه بعد از بارگذاری کلیک می‌کردند، پس آن را نمی‌دیدند.
- The bug pre-dates 1.15.0 (reproduced against `origin/main`) and only appeared on a *return* visit with a stored language — the previous DOM tests all click after load, so none of them saw it.

## ♿ دسترس‌پذیری / Accessibility

- برچسب `aria-label`/`title` دکمهٔ ☀️/🌙 با تعویض زبان به‌روز نمی‌شد و در حالت انگلیسی فارسی می‌ماند («حالت روز»)؛ حالا با هر تعویض زبان بازسازی می‌شود — با گاردی که انتخاب «روز» کاربر را در نخستین اجرا بازنویسی نکند.
- The ☀️/🌙 button's `aria-label`/`title` was not rebuilt on a language switch, so English mode kept the Persian label («حالت روز»). It now follows the language, guarded so it cannot overwrite a saved day-theme choice during the first paint.

## 🧪 تست‌ها / Tests

- **۷۴ تست** (از ۷۱) — سه تست DOM جدید که هر دو باگ را قفل می‌کنند:
  برچسب دکمهٔ پوسته با تعویض زبان، ماندگاری پوستهٔ روز در بارگذاری نخست با زبان انگلیسی، و «بازدیدکنندهٔ انگلیسی‌زبانِ بازگشتی صفحهٔ کاملاً سیم‌کشی‌شده می‌گیرد» (اعتبارسنج + منوی همبرگری + پوسته).
- **74 tests** (up from 71) — three new DOM tests lock both bugs: the toggle label following the language switch, a saved day theme surviving an English first paint, and "a returning English visitor gets a fully wired page" (validator + burger menu + theme).

## 📦 دانلود / Downloads

| فایل / File | برای / For |
|---|---|
| `Naxlo-Setup-1.15.1.exe` | ویندوز — نصب‌کنندهٔ نسخهٔ اصلی / Windows main installer |
| `Naxlo-Portable-1.15.1.exe` | ویندوز — پرتابل / Windows portable |
| `Naxlo-Rust-Setup-1.15.1.exe` | ویندوز — نسخهٔ سبک Rust / Windows lean Rust edition |
| `Naxlo-Rust-v1.15.1-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.15.1-macos-arm64.dmg` | مک (Apple Silicon) / macOS |
| `Naxlo-android-v1.15.1-debug.apk` / `-unsigned.apk` | اندروید / Android |
| `naxlo-website.zip` | کل وب‌سایت آمادهٔ cPanel — **همین را جایگزین کنید** / full cPanel-ready website — **replace your copy with this one** |

همهٔ فایل‌ها با `SHA256SUMS.txt` و checksum تکی. / Every asset ships with `SHA256SUMS.txt` plus per-file checksums.

## 🧾 یادداشت‌ها / Notes

- تغییرات این نسخه فقط در وب‌سایت است؛ اپ دسکتاپ، نسخهٔ Rust و اندروید از نظر عملکردی مثل ۱.۱۵.۰ هستند (فقط شمارهٔ نسخه). اگر وب‌سایت را روی cPanel دارید، زیپ جدید را جایگزین کنید.
- This release only changes the website; the desktop app, the Rust edition and Android are functionally identical to 1.15.0 (version bump only). If you host the site on cPanel, replace it with the new zip.
- اندروید: versionCode 2106 / versionName 1.15.1. / Android: versionCode 2106 / versionName 1.15.1.
