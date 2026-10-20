# naxlo v1.5.0

## فارسی

**وارد کردن کانفیگ از فایل + پشتیبانی از فایل‌های رمزدار 🔐**

- 📁 **وارد کردن از فایل** (ویندوز و اندروید): علاوه بر لینک اشتراک، حالا می‌توانید فایل‌های کانفیگ را مستقیم از گوشی/کامپیوتر وارد کنید — `txt`, `json`, `conf`, `sub` (خام یا Base64) و **ZIP**.
- 🔑 **فایل رمزدار؟** اگر فایل زیپ رمز داشته باشد، پنجرهٔ واردکردن رمز باز می‌شود. رمز یک‌بار پرسیده می‌شود و به‌صورت **رمزنگاری‌شده** ذخیره می‌شود تا رفرش‌های بعدی بدون سؤال انجام شود. رمز اشتباه هم پیام مشخص دارد.
  - در ویندوز الگوریتم استاندارد ZipCrypto (همان رمز معمول WinRAR) پیاده‌سازی شده؛ در اندروید علاوه بر آن، زیپ‌های AES هم پشتیبانی می‌شوند.
- 🔁 فایل واردشده مثل یک اشتراک کامل رفتار می‌کند: در فهرست اشتراک‌ها با برچسب «فایل» دیده می‌شود، دکمهٔ رفرش دارد و حذفش فقط سرورهای خودش را پاک می‌کند.
- 🔒 مثل همیشه: مسیر فایل، رمز و محتوای کانفیگ‌ها **هرگز در لاگ ثبت نمی‌شوند**.

### فایل‌ها
| فایل | توضیح |
|---|---|
| `Naxlo-Setup-1.5.0.exe` | نصب‌کنندهٔ ویندوز |
| `Naxlo-Portable-1.5.0.exe` | نسخهٔ پرتابل |
| `Naxlo-android-v1.5.0-debug.apk` | اپ اندروید (قابل نصب) |
| `Naxlo-android-v1.5.0-unsigned.apk` | بیلد release بدون امضا |
| `latest.yml` / `SHA256SUMS.txt` | خوراک به‌روزرسانی خودکار و checksum |

> ویندوز: برنامهٔ نصب‌شده خودش این نسخه را خودکار دانلود و با یک ریستارت نصب می‌کند.
> اندروید: APK جدید را نصب کنید؛ داده‌های شما حفظ می‌شود.

## English

**Import configs from files + password-protected archives 🔐**

- 📁 **File import (Windows + Android):** besides subscription links, config files can now be imported straight from disk — `txt`, `json`, `conf`, `sub` (raw or Base64) and **ZIP** archives.
- 🔑 **Password-protected?** Encrypted ZIPs open a password prompt. The password is asked once, stored **encrypted**, and reused silently on later refreshes; a wrong password reports clearly. Windows implements classic ZipCrypto (WinRAR-style) natively; Android also supports AES zips via zip4j.
- 🔁 An imported file behaves like a full subscription: it shows up in the list with a "File" badge, has its own refresh button, and removing it only drops its servers.
- 🔒 As always, file paths, passwords and config contents are **never written to logs**.
