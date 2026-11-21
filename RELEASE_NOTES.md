# Naxlo 1.16.0 — speaks your language from the first launch / نخستین اجرا به زبان خودتان

Naxlo now opens in the language of your operating system, the native file dialogs follow
that choice, and the repository front page is fully bilingual. Everything else keeps
working exactly as before: encrypted storage, no secrets in logs, proxy and optional TUN
mode, stats, tools and the day theme.

ناکسلو حالا با زبان خود سیستم‌عامل باز می‌شود، دیالوگ‌های بومی انتخاب فایل همان زبان را
دنبال می‌کنند و صفحهٔ اصلی مخزن کاملاً دوزبانه شد. بقیهٔ چیزها دقیقاً مثل قبل کار
می‌کنند: ذخیرهٔ رمزنگاری‌شده، بدون ثبت هیچ رازی در لاگ، پروکسی و حالت TUN اختیاری، آمار،
ابزارها و پوستهٔ روز.

---

## English

### 1. First launch follows the system language — all four clients plus the website

Every client used to hard-code Persian on a fresh install, so an English or Turkish desktop
opened in Persian and you had to hunt for the language switch first. Naxlo now maps the OS
locale onto the languages it ships:

| Client | Locale source | Result |
| --- | --- | --- |
| Electron (Windows) | `app.getLocale()` → `languageFromLocale()` | `en…` → English, `tr…` → Turkish, anything else → Persian |
| Rust / Tauri (Windows, Linux, macOS) | `LC_ALL`, then `LC_MESSAGES`, then `LANG` (`C`/`POSIX` ignored) | same mapping |
| Android | `Locale.getDefault().language` | same mapping |
| Website (vpn.naxlo.ir) | `navigator.language` | `en…` → English, everything else → Persian (the site ships fa + en only) |

Detection happens **only** when nothing is stored yet. A saved choice always wins, an
existing install is untouched, and Persian stays the fallback everywhere — including on
Windows, where the Rust edition reads no locale variables at all.

### 2. Native OS dialogs are localized

The two Electron dialogs — the config-file import picker and the Xray-core picker — and the
two Rust/Tauri equivalents were always Persian, whatever language the app was running in.
That was the last place an English user could still meet Persian text. Titles and button
labels now go through the new `pickL()` (TypeScript) and `l10n::pick()` (Rust) helpers and
render in the active language, and `tr_map` gained the two Turkish strings
("Choose a config file", "Choose the Xray executable").

### 3. A complete English README

The repository front page was Persian-only apart from a handful of headings. It now has an
English tagline, a **فارسی · English** switcher in the header, and a full English section:

- the feature table (subscriptions, servers, connection, TUN, stats, tools, UI, Android, updates)
- an install table per platform, with the unsigned-macOS Gatekeeper note and the website zip
- the connection flow, from subscription link to `SOCKS5 127.0.0.1:10808` / `HTTP :10809`
- the privacy guarantees (encrypted vault, log redaction, client-side validator and QR)
- build-from-source commands for all four targets, plus the offline Xray-core fetch
- project layout, contributing rules and license

### 4. Tests: 86 local (was 82)

- one new smoke test locks the `languageFromLocale` mapping — including that
  `DEFAULT_SETTINGS.language` stays `fa`, so detection can never silently change an install
- three new website DOM tests: an English browser gets English on the very first visit (and
  the choice is remembered), a stored language always beats the browser language, and a
  Turkish browser keeps Persian because the site has no Turkish build
- the jsdom harness now pins `navigator.language` to `fa-IR`, so the existing 30 site tests
  keep measuring the default Persian experience instead of jsdom's built-in `en-US`

### Downloads

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `Naxlo-Setup-1.16.0.exe` | Electron edition, full feature set, silent self-update |
| Windows | `Naxlo-Portable-1.16.0.exe` | Portable Electron build |
| Windows | `Naxlo-Rust-Setup-1.16.0.exe` | Rust/Tauri edition (lean, proxy mode) |
| Linux | `Naxlo-Rust-1.16.0-linux-amd64.AppImage` / `.deb` | Rust/Tauri edition |
| macOS | `Naxlo-Rust-1.16.0-macos-arm64.dmg` | Unsigned — run `xattr -cr /Applications/naxlo.app` once |
| Android | `Naxlo-android-v1.16.0-debug.apk` | Native Kotlin client, no root, Quick Settings tile |
| Website | `naxlo-website.zip` | Unzip into cPanel's `public_html` for vpn.naxlo.ir |

`SHA256SUMS.txt` covers every binary in this release.

### Tests & build

**86 local tests** (53 smoke + 33 website DOM), **13 Android unit tests** and **13 Rust
tests** in CI — all green, together with `npm run typecheck`, `npm test` and `npm run build`.

---

## فارسی

### ۱. نخستین اجرا زبان خود سیستم‌عامل را دنبال می‌کند — هر چهار کلاینت و وب‌سایت

تا امروز همهٔ کلاینت‌ها در نصب تازه فارسی را ثابت می‌کردند؛ یعنی یک دسکتاپ انگلیسی یا
ترکی با فارسی باز می‌شد و کاربر باید اول کلید تعویض زبان را پیدا می‌کرد. حالا locale
سیستم به زبان‌های موجود نگاشت می‌شود:

| کلاینت | منبع locale | نتیجه |
| --- | --- | --- |
| Electron (ویندوز) | `app.getLocale()` ← `languageFromLocale()` | `en…` ← انگلیسی، `tr…` ← ترکی، بقیه ← فارسی |
| Rust / Tauri (ویندوز، لینوکس، مک) | `LC_ALL` سپس `LC_MESSAGES` سپس `LANG` (بدون `C`/`POSIX`) | همان نگاشت |
| اندروید | `Locale.getDefault().language` | همان نگاشت |
| وب‌سایت (vpn.naxlo.ir) | `navigator.language` | `en…` ← انگلیسی، بقیه ← فارسی (سایت فقط fa + en دارد) |

تشخیص **فقط** وقتی انجام می‌شود که هنوز چیزی ذخیره نشده باشد. انتخاب ذخیره‌شده همیشه
اولویت دارد، نصب‌های قبلی دست‌نخورده می‌مانند و فارسی همه‌جا فالبک است — از جمله روی
ویندوز که نسخهٔ Rust هیچ متغیر locale نمی‌خواند.

### ۲. دیالوگ‌های بومی سیستم‌عامل بومی‌سازی شدند

دو دیالوگ Electron (انتخاب فایل کانفیگ برای واردکردن و انتخاب فایل اجرایی Xray) و دو
معادل Rust/Tauri همیشه فارسی بودند، هر زبانی که اپ داشت. این آخرین جایی بود که یک کاربر
انگلیسی‌زبان می‌توانست متن فارسی ببیند. حالا عنوان و برچسب دکمه از `pickL()` (تایپ‌اسکریپت)
و `l10n::pick()` (راست) رد می‌شوند و به زبان فعال نمایش داده می‌شوند؛ دو رشتهٔ ترکی هم به
`tr_map` اضافه شد.

### ۳. README انگلیسی کامل

صفحهٔ اصلی مخزن جز چند سرفصل فقط فارسی بود. حالا تگ‌لاین انگلیسی، کلید **فارسی · English**
در سربرگ و یک بخش کامل انگلیسی دارد: جدول امکانات، جدول نصب برای هر پلتفرم (با نکتهٔ
Gatekeeper مک و zip سایت)، مسیر اتصال از لینک اشتراک تا `SOCKS5 127.0.0.1:10808`، تضمین‌های
حریم خصوصی، دستورهای ساخت از سورس برای هر چهار هدف، ساختار پروژه، قوانین مشارکت و پروانه.

### ۴. تست‌ها: ۸۶ تست محلی (پیش‌تر ۸۲)

- یک تست smoke جدید نگاشت `languageFromLocale` را قفل می‌کند — از جمله اینکه
  `DEFAULT_SETTINGS.language` همان `fa` می‌ماند، پس تشخیص زبان هرگز بی‌صدا یک نصب موجود را
  عوض نمی‌کند
- سه تست DOM جدید برای سایت: مرورگر انگلیسی در نخستین بازدید انگلیسی می‌گیرد (و انتخابش
  ذخیره می‌شود)، زبان ذخیره‌شده همیشه بر زبان مرورگر می‌چربد، و مرورگر ترکی فارسی می‌ماند
  چون سایت نسخهٔ ترکی ندارد
- محیط jsdom حالا `navigator.language` را روی `fa-IR` قفل می‌کند تا همان ۳۰ تست قبلی سایت،
  تجربهٔ پیش‌فرض فارسی را بسنجند نه `en-US` داخلی jsdom را

### دانلود

| پلتفرم | فایل | توضیح |
| --- | --- | --- |
| ویندوز | `Naxlo-Setup-1.16.0.exe` | نسخهٔ Electron با همهٔ امکانات و به‌روزرسانی خاموش خودکار |
| ویندوز | `Naxlo-Portable-1.16.0.exe` | ساخت پرتابل Electron |
| ویندوز | `Naxlo-Rust-Setup-1.16.0.exe` | نسخهٔ Rust/Tauri (سبک، حالت پروکسی) |
| لینوکس | `Naxlo-Rust-1.16.0-linux-amd64.AppImage` / `.deb` | نسخهٔ Rust/Tauri |
| مک | `Naxlo-Rust-1.16.0-macos-arm64.dmg` | بدون امضا — یک‌بار `xattr -cr /Applications/naxlo.app` |
| اندروید | `Naxlo-android-v1.16.0-debug.apk` | کلاینت بومی Kotlin، بدون روت، با کاشی Quick Settings |
| وب‌سایت | `naxlo-website.zip` | بازکردن در `public_html` سی‌پنل برای vpn.naxlo.ir |

`SHA256SUMS.txt` همهٔ باینری‌های این انتشار را پوشش می‌دهد.

### تست و ساخت

**۸۶ تست محلی** (۵۳ smoke + ۳۳ DOM سایت)، **۱۳ تست واحد اندروید** و **۱۳ تست Rust** در CI —
همه سبز، همراه با `npm run typecheck`، `npm test` و `npm run build`.
