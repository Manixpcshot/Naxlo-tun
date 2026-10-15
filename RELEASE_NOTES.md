# Naxlo v1.0.0 🌑

نخستین انتشار رسمی **ناکسلو** — کلاینت فارسی‌زبان VLESS برای ویندوز بر پایهٔ Electron، React و هستهٔ رسمی Xray-core
در حالت **پروکسی محلی** (بدون TUN و بدون Wintun).

## چه چیزهایی در این نسخه هست؟

- 🔑 **اشتراک:** وارد کردن لینک اشتراک، دریافت فایل TXT، بازگشایی Base64 و تجزیهٔ کانفیگ‌های VLESS (و Trojan/VMess).
- 🖥️ **فهرست سرورها:** جست‌وجو، فیلتر، تست تأخیر تکی و گروهی، مرتب‌سازی بر اساس سرعت، انتخاب و اتصال.
- ⚡ **اتصال یک‌کلیکی:** اجرای Xray با اینباندهای SOCKS5/HTTP روی `127.0.0.1`، تست واقعی عبور ترافیک، نمایش وضعیت/آی‌پی/مدت اتصال.
- 🧩 **پروکسی سیستم (اختیاری):** تنظیم خودکار پروکسی ویندوز و بازگردانی دقیق تنظیمات قبلی هنگام قطع.
- 🧠 **هستهٔ Xray:** دانلود خودکار از ریلیز رسمی + اعتبارسنجی SHA-512 + امکان انتخاب فایل دلخواه + بررسی نسخهٔ جدید.
- 🔒 **حریم خصوصی:** خزانهٔ رمزنگاری‌شده (DPAPI)، نمایش پوشیدهٔ مقادیر حساس، پالایگر لاگ و حذف کانفیگ پس از استفاده.
- 🌙 **طراحی:** تم مشکی با یک رنگ تأکیدی، رابط کاملاً راست‌چین با قلم وزیرمتن، انیمیشن‌های نرم و آیکون اختصاصی.

## فایل‌های نصب

| فایل | توضیح |
| --- | --- |
| `Naxlo-Setup-1.0.0.exe` | نصب‌کنندهٔ NSIS (پیشنهادی) |
| `Naxlo-Portable-1.0.0.exe` | نسخهٔ پرتابل بدون نصب |
| `SHA256SUMS.txt` | کنترل یکپارچگی خروجی‌ها |

هر دو خروجی همراه با هستهٔ Xray بسته‌بندی شده‌اند؛ در صورت نبود هسته، برنامه در نخستین اجرا آن را خودکار دانلود و
اعتبارسنجی می‌کند.

## حداقل نیازمندی

ویندوز ۱۰ یا ۱۱ (x64). بدون نیاز به دسترسی مدیر؛ هیچ درایور یا سرویسی نصب نمی‌شود.

## یادداشت‌های امنیتی

لینک اشتراک و کلیدها فقط در خزانهٔ رمزنگاری‌شدهٔ کاربر ذخیره می‌شوند، در رابط کاربری پوشیده نمایش داده می‌شوند و
هرگز در لاگ نوشته نمی‌شوند. جزئیات بیشتر در [SECURITY.md](https://github.com/Manixpcshot/Naxlo-tun/blob/main/SECURITY.md).

---

**English:** First public release of Naxlo — a Persian RTL, dark-themed Windows client for VLESS subscriptions
(Electron + React + official Xray-core in local-proxy mode: SOCKS5 + HTTP on loopback, optional WinINET system
proxy, no TUN/Wintun, no admin rights). Includes subscription fetch + Base64 decode, server list with latency
testing, encrypted secret vault with masked UI and redacted logs, checksum-verified core download, and NSIS +
portable installers with SHA-256 sums.
