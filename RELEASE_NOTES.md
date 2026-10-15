# naxlo v1.4.1

## فارسی

**رفع دو مشکل مهم:**

- 📱 **اندروید**: مشکل باز نشدن برنامه برطرف شد. علت، ناسازگاری تم فعالیت با `AppCompatActivity` بود؛ اکنون تم سازگار است و علاوه بر آن، استارت‌اپ برنامه در برابر خطاهای Keystore و زبان مقاوم‌سازی شد — اپلیکیشن تحت هر شرایطی باز می‌شود.
- 💻 **ویندوز**: به‌روزرسانی اکنون کاملاً خودکار است و **هیچ‌وقت لینک ریپازیتوری/مرورگر باز نمی‌شود**. برنامه در پس‌زمینه نسخهٔ جدید را دانلود و اعتبارسنجی (sha512) می‌کند، نصب بی‌صدا انجام می‌شود و برنامه **فقط یک‌بار** بسته و با نسخهٔ جدید باز می‌شود. دکمهٔ «بررسی به‌روزرسانی» هم به‌جای بازکردن لینک، همان خط لولهٔ خودکار را شروع می‌کند. در صورت قطعی موقت شبکه، تلاش مجدد خودکار پس از ۴۵ ثانیه انجام می‌شود.

### فایل‌ها
| فایل | توضیح |
|---|---|
| `Naxlo-Setup-1.4.1.exe` | نصب‌کنندهٔ ویندوز |
| `Naxlo-Portable-1.4.1.exe` | نسخهٔ پرتابل |
| `Naxlo-android-v1.4.1-debug.apk` | اپ اندروید (قابل نصب) |
| `Naxlo-android-v1.4.1-unsigned.apk` | بیلد release بدون امضا |
| `latest.yml` / `SHA256SUMS.txt` | خوراک به‌روزرسانی خودکار و checksum |

> کاربران نسخهٔ ۱.۴.۰ ویندوز: برنامه خودش این نسخه را دانلود و با یک ریستارت نصب می‌کند.
> کاربران اندروید: APK جدید را نصب کنید (روی نسخهٔ قبلی قابل نصب است؛ داده‌ها حفظ می‌شود).

## English

**Two critical fixes:**

- 📱 **Android**: the launch crash is fixed — the activity theme is now AppCompat-compatible, and start-up is hardened so Keystore/locale errors can never prevent the app from opening.
- 💻 **Windows**: self-update is fully automatic and **never opens the repository link or a browser**. Updates download silently in the background, sha512 is verified, the installer runs silently and the app restarts **exactly once**. The manual "check for update" button now triggers the same pipeline instead of opening a link, and transient network failures retry automatically after 45 s.
