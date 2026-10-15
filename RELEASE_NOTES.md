# Naxlo v1.1.1 🩹

## چه چیزی درست شد؟

- 🎨 **بازگشت کامل استایل‌ها:** در v1.1.0 یک سمیکالن جاافتاده بعد از `@import` پرچم‌ها باعث شد کل لایهٔ layout/کامپوننت‌ها
  از باندل CSS حذف شود و برنامه بدون استایل اجرا شود. import ترمیم شد و خروجی build حالا بررسی می‌شود که قوانین layout
  واقعاً داخل باندل باشند.
- 🚩 **پرچم‌ها نمایش داده می‌شوند:** سلکتورهای `flags.css` با قرارداد کامپوننت `Flag` (`[data-flag="xx"]`) هم‌خوان شدند.
- 🧪 **تست regression جدید:** هر `@import` در `global.css` باید سمیکالن داشته باشد و contract پرچم‌ها تست می‌شود — دیگر
  یک کاراکتر جاافتاده کل UI را از کار نمی‌اندازد.

اگر v1.1.0 را نصب کرده‌اید، برنامه به‌صورت خودکار به 1.1.1 به‌روزرسانی می‌شود (یک‌بار بسته و باز می‌شود).

## فایل‌های این ریلیز

| فایل | توضیح |
| --- | --- |
| `Naxlo-Setup-1.1.1.exe` | نصب‌کنندهٔ NSIS (پیشنهادی) |
| `Naxlo-Portable-1.1.1.exe` | نسخهٔ پرتابل |
| `latest.yml` | خوراک به‌روزرسانی خودکار |
| `SHA256SUMS.txt` | کنترل یکپارچگی |

---

**English:** v1.1.1 is a hotfix for v1.1.0: a missing semicolon after the flags `@import` in `global.css` made the
CSS parser drop the entire component/layout layer from the shipped bundle (the app rendered unstyled). The import is
fixed, flag selectors now match the `Flag` component (`[data-flag="xx"]`) so country flags render, and new regression
tests assert both the import hygiene and the flag selector contract. Existing 1.1.0 installs auto-update to 1.1.1
(silent download, one restart).
