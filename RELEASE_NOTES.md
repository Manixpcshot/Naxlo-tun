# Naxlo v1.4.0 📱

## چه چیزهای جدیدی آمد؟

- 📱 **ناکسلو برای اندروید** — کلاینت بومی Kotlin در پوشهٔ `android/`:
  - تونل بر پایهٔ VpnService خود اندروید (بدون روت، بدون درایور سیستمی) با هستهٔ Xray باندل‌شده با gomobile
    (`libv2ray.aar`) — همان پشتیبانی VLESS/REALITY/WebSocket/gRPC دسکتاپ.
  - import اشتراک با رمزگشایی Base64، نوارهای حجم از هدر `subscription-userinfo` و نام اشتراک از `profile-title`.
  - لیست سرورها با پین، تست تأخیر و جست‌وجو؛ UI سه‌زبانه (فا/ان/تر) با همان طراحی نزدیک‌مشکی دسکتاپ.
  - والت رمزنگاری‌شده (Android Keystore) برای لینک‌ها و کلیدها؛ هیچ مقدار حساسی در لاگ نمی‌آید.
  - بیلد APK روی GitHub Actions؛ فایل‌های `Naxlo-android-v1.4.0-debug.apk` و `-unsigned.apk` کنار نصب‌کننده‌های ویندوز
    در همین ریلیز منتشر می‌شوند.

## فایل‌های این ریلیز

| فایل | توضیح |
| --- | --- |
| `Naxlo-Setup-1.4.0.exe` / `Naxlo-Portable-1.4.0.exe` | نصب‌کننده و پرتابل ویندوز |
| `Naxlo-android-v1.4.0-debug.apk` | APK اندروید (امضای debug، برای نصب مستقیم) |
| `Naxlo-android-v1.4.0-unsigned.apk` | APK ریلیز بدون امضا |
| `latest.yml` / `SHA256SUMS.txt` | خوراک آپدیت خودکار / کنترل یکپارچگی |

---

**English:** v1.4.0 ships **Naxlo for Android** — a native Kotlin client with a VpnService tunnel (no root), the
gomobile-bound Xray core, subscription import with quota bars, pins/latency tests and the trilingual near-black UI.
Debug + unsigned APKs are attached to this release next to the Windows installers; desktop users on 1.1.1+
auto-update as usual.
