# naxlo v1.6.0

## فارسی

**حالت TUN کل‌سیستمی + هشدار خروج 🌐🚪**

- 🌐 **حالت TUN (اختیاری، ویندوز):** در «تنظیمات → پروکسی محلی» یک کلید جدید اضافه شده: **حالت اتصال**.
  - **پروکسی (پیش‌فرض):** همان رفتار همیشگی — اینباندهای لوکال + پروکسی سیستم ویندوز؛ سبک و بدون درایور.
  - **TUN کل‌سیستمی:** کل ترافیک ویندوز از تونل عبور می‌کند — **حتی برنامه‌هایی که پروکسی را نادیده می‌گیرند** (بسیاری از برنامه‌های استور/UWP، بعضی CLIها و بازی‌ها). از **اینباند TUN داخلی خود Xray** استفاده می‌شود (بدون هیچ برنامهٔ جانبی).
- 🛡️ **درایور رسمی Wintun:** نسخهٔ ۰.۱۴.۱ مستقیم از wintun.net دانلود و با **SHA-256 پین‌شده** اعتبارسنجی می‌شود؛ فقط هنگام اولین اتصال TUN، کنار هسته ذخیره می‌شود.
- 🔑 **فقط یک‌بار تأیید مدیر (UAC):** وقتی حالت TUN را روشن کنید، برنامه یک‌بار با دسترسی مدیر باز می‌شود و پس از آن **اتصال خودکار** برقرار می‌شود. هنگام قطع یا خروج، آداپتور و روت‌های سیستم به‌تمیزی حذف می‌شوند.
- 🚪 **هشدار خروج (ویندوز + اندروید):** بستن برنامه در حالت اتصال دیگر خاموش نیست! یک هشدار سه‌گزینه‌ای می‌آید:
  - **خاموش کن و ببند** — اول اتصال قطع (و پروکسی/تونل پاک) می‌شود، بعد برنامه بسته می‌شود.
  - **متصل بمان و ببند** — ویندوز: رفتن به tray با اتصال فعال؛ اندروید: تونل در اعلان فعال می‌ماند و رابط بسته می‌شود.
  - **لغو**.
- ⚙️ **ارتقای هسته:** Xray پین‌شده از v26.3.27 به **v26.10.31** ارتقا یافت (شامل رفع امنیتی MPTCP).
- 🔒 مثل همیشه: لینک اشتراک و کانفیگ‌ها رمزنگاری‌شده می‌مانند و **هرگز در لاگ ثبت نمی‌شوند**.

### فایل‌ها
| فایل | توضیح |
|---|---|
| `Naxlo-Setup-1.6.0.exe` | نصب‌کنندهٔ ویندوز |
| `Naxlo-Portable-1.6.0.exe` | نسخهٔ پرتابل |
| `Naxlo-android-v1.6.0-debug.apk` | اپ اندروید (قابل نصب) |
| `Naxlo-android-v1.6.0-unsigned.apk` | بیلد release بدون امضا |
| `latest.yml` / `SHA256SUMS.txt` | خوراک به‌روزرسانی خودکار و checksum |

> ویندوز: برنامهٔ نصب‌شده خودش این نسخه را خودکار دانلود و با یک ریستارت نصب می‌کند.
> اندروید: APK جدید را نصب کنید؛ داده‌های شما حفظ می‌شود.

## English

**System-wide TUN mode + exit warning 🌐🚪**

- 🌐 **TUN mode (optional, Windows):** Settings now has a **Connection mode** switch.
  - **Proxy (default):** the classic behavior — local inbounds + Windows system proxy; light and driver-free.
  - **System-wide TUN:** all Windows traffic goes through the tunnel — **including apps that ignore the proxy** (most Store/UWP apps, some CLIs and games). It uses **Xray's built-in TUN inbound** (no sidecar process).
- 🛡️ **Official Wintun driver:** 0.14.1 is downloaded straight from wintun.net and verified against a **pinned SHA-256**, stored next to the core on the first TUN connection.
- 🔑 **One-time UAC elevation:** turning on TUN relaunches the app once as administrator and then **auto-connects**. On disconnect/exit the adapter and system routes are cleaned up.
- 🚪 **Exit warning (Windows + Android):** closing while connected now asks first:
  - **Disconnect and close** — the tunnel/proxy is torn down, then the app quits.
  - **Stay connected and close** — Windows: minimize to tray with the connection up; Android: the tunnel keeps running behind the notification while the UI closes.
  - **Cancel**.
- ⚙️ **Core upgrade:** pinned Xray moved from v26.3.27 to **v26.10.31** (includes the MPTCP security fix).
- 🔒 As always: subscription links and configs stay encrypted and are **never written to logs**.
