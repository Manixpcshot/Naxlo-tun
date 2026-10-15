# Naxlo v1.2.0 📊

## چه چیزهای جدیدی آمد؟

- 📚 **چند اشتراک:** چند لینک اشتراک را کنار هم نگه دارید؛ سرورهای هر اشتراک جدا گروه‌بندی می‌شوند، هر اشتراک دکمهٔ
  به‌روزرسانی و حذف مستقل دارد و حذف یکی به بقیه دست نمی‌زند. والت‌های نسخه‌های قبل خودکار مهاجرت می‌کنند.
- 📊 **حجم و انقضا (مثل Happ):** هدر استاندارد `subscription-userinfo` خوانده می‌شود و نوار مصرف با «مصرف‌شده /
  باقی‌مانده / کل حجم» به‌همراه روزهای مانده تا انقضا نمایش داده می‌شود — هم در صفحهٔ اشتراک و هم در صفحهٔ اصلی برای
  اشتراک فعال.
- 🏷️ **نام اشتراک از خود سرویس:** هدر `profile-title` (ساده، url-encoded یا base64) به‌عنوان نام اشتراک استفاده می‌شود.
- ⚡ **تست سرعت:** اندازه‌گیری دانلود واقعی (مگابیت بر ثانیه) از طریق پروکسی فعال، در کارت حجم صفحهٔ اصلی.
- 🗂️ **صفحهٔ سرورها گروه‌بندی شد:** سرورها زیر سربرگ اشتراک خودشان فهرست می‌شوند (با شمارنده، حجم و دکمهٔ به‌روزرسانی).

## فایل‌های این ریلیز

| فایل | توضیح |
| --- | --- |
| `Naxlo-Setup-1.2.0.exe` | نصب‌کنندهٔ NSIS (پیشنهادی) |
| `Naxlo-Portable-1.2.0.exe` | نسخهٔ پرتابل |
| `latest.yml` | خوراک به‌روزرسانی خودکار |
| `SHA256SUMS.txt` | کنترل یکپارچگی |

نسخه‌های ۱.۱.۱ و جدیدتر به‌صورت خودکار (یک‌بار restart) به این نسخه به‌روزرسانی می‌شوند.

---

**English:** Naxlo 1.2.0 adds **multiple subscriptions** (separate server groups, per-subscription refresh/remove,
automatic vault migration), a **Happ-style quota panel** (used/remaining/total traffic + expiry countdown parsed from
`subscription-userinfo`), **subscription names from `profile-title`**, a **real speed test** through the active proxy
(Mbps) and a grouped Servers page. Installs on 1.1.1+ auto-update with a single restart.
