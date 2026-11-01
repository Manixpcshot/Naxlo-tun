# naxlo v1.7.0

## فارسی

**نسخهٔ Rust + لینوکس + مک 🦀🐧🍎**

- 🦀 **نسخهٔ Rust/Tauri:** از این نسخه، همان رابط زیبای React روی یک بک‌اند **Rust** (Tauri v2 با WebView بومی — بدون Chromium) هم منتشر می‌شود:
  - افزودن اشتراک با لینک، دریافت و بازگشایی Base64، تجزیهٔ `vless://`/`trojan://`/`vmess://`، نام و سهمیهٔ پنل از هدرهای استاندارد
  - اتصال/قطع در حالت **پروکسی محلی** با هستهٔ رسمی Xray (پین `v26.10.31`، دانلود خودکار + اعتبارسنجی digest)
  - تست تأخیر تکی و گروهی، تست سرعت، انتخاب خودکار بهترین سرور، پین‌ها و هشدار خروج هنگام اتصال
  - خزانهٔ رمزنگاری‌شدهٔ **AES-256-GCM** (کلید تصادفی با دسترسی `0600`) و ماسک کامل مقادیر حساس — مثل همیشه **هرگز در لاگ ثبت نمی‌شوند**
- 🐧 **لینوکس:** خروجی **AppImage** (بدون نصب) و **deb** (دبیان/اوبونتو)
- 🍎 **مک:** خروجی **DMG** برای Apple Silicon — **بدون امضای Apple**؛ بار اول با کلیک راست → Open یا دستور `xattr -cr /Applications/naxlo.app` اجرا کنید
- 🪟 **ویندوز:** نصب‌کنندهٔ NSIS برای نسخهٔ Rust در کنار نسخهٔ Electron
- 🌐 **پروکسی سیستم در هر سه سیستم‌عامل:** ویندوز (WinINET با پشتیبان‌گیری دقیق)، مک (`networksetup`) و لینوکس (`gsettings`) — هنگام قطع یا خروج، تنظیمات قبلی بازگردانده می‌شود
- 📝 **دامنهٔ نسخهٔ Rust فعلاً lean است:** حالت TUN، tray، شروع خودکار، به‌روزرسانی خودکار برنامه و وارد کردن از فایل در این نسخه **Electron-only** هستند و در آپدیت‌های بعدی به Rust هم می‌آیند
- 🤖 اندروید: versionName 1.7.0 (بدون تغییر عملکردی)

### فایل‌ها
| فایل | توضیح |
|---|---|
| `Naxlo-Setup-1.7.0.exe` | نصب‌کنندهٔ ویندوز (Electron — نسخهٔ کامل با TUN و به‌روزرسانی خودکار) |
| `Naxlo-Portable-1.7.0.exe` | نسخهٔ پرتابل Electron |
| `Naxlo-Rust-Setup-1.7.0.exe` | نصب‌کنندهٔ ویندوز برای نسخهٔ Rust/Tauri |
| `Naxlo-Rust-v1.7.0-linux-amd64.AppImage` | لینوکس — قابل‌اجرا بدون نصب |
| `Naxlo-Rust-v1.7.0-linux-amd64.deb` | دبیان/اوبونتو |
| `Naxlo-Rust-v1.7.0-macos-arm64.dmg` | مک (Apple Silicon، بدون امضا) |
| `Naxlo-android-v1.7.0-debug.apk` | اپ اندروید (قابل نصب) |
| `Naxlo-android-v1.7.0-unsigned.apk` | بیلد release بدون امضا |
| `latest.yml` / `SHA256SUMS.txt` / `*.sha256` | خوراک به‌روزرسانی خودکار و checksum فایل‌ها |

> ویندوز (Electron): برنامهٔ نصب‌شده خودش این نسخه را خودکار دانلود و با یک ریستارت نصب می‌کند.
> اندروید: APK جدید را نصب کنید؛ داده‌های شما حفظ می‌شود.
> نسخهٔ Rust: داده‌ها در پوشهٔ برنامهٔ خودش ذخیره می‌شود (`net.naxlo.rust`) — مستقل از نسخهٔ Electron.

## English

**Rust edition + Linux + macOS 🦀🐧🍎**

- 🦀 **Rust/Tauri edition:** the same React UI now also ships on a **Rust** backend (Tauri v2, native webview — no Chromium):
  - Add subscriptions by URL, fetch + Base64-decode, parse `vless://`/`trojan://`/`vmess://`, panel name/quota from the standard headers
  - Connect/disconnect in **local-proxy mode** with the official Xray core (pinned `v26.10.31`, auto-download + digest verification)
  - Single & batch latency tests, speed test, auto best-server pick, pins and the connected-exit warning dialog
  - **AES-256-GCM** encrypted vault (random key file, `0600`) and full masking — secrets are, as always, **never logged**
- 🐧 **Linux:** **AppImage** (no install) and **deb** (Debian/Ubuntu)
- 🍎 **macOS:** **DMG** for Apple Silicon — **unsigned**; first launch via right-click → Open or `xattr -cr /Applications/naxlo.app`
- 🪟 **Windows:** NSIS installer for the Rust edition alongside the Electron build
- 🌐 **System proxy on all three OSes:** Windows (WinINET with exact backup/restore), macOS (`networksetup`) and Linux (`gsettings`)
- 📝 **Lean scope for now:** TUN mode, tray, auto-start, app self-update and file import remain **Electron-only**; they will land in the Rust edition in later releases
- 🤖 Android: versionName 1.7.0 (no functional change)
