# Naxlo 1.15.0 — Android connecting fixed, day theme, daily stats & in-app tools ☀️

> کلاینت فارسی‌زبان VLESS برای ویندوز، لینوکس، مک و اندروید بر پایهٔ هسته رسمی Xray
> Persian-first VLESS client for Windows, Linux, macOS and Android on the official Xray core.

## 🤖 اندروید: اتصال درست شد / Android: connecting now works

- ریشهٔ مشکل: کانفیگی که به libv2ray داده می‌شد هیچ **`tun` inbound** نداشت. libv2ray فقط fd تونل را با متغیر محیطی `xray.tun.fd` به هسته می‌دهد، پس بدون این inbound هیچ‌کس بسته‌ها را نمی‌خواند و `addRoute("0.0.0.0", 0)` تمام ترافیک را به سیاه‌چاله می‌برد — نتیجه: «متصل» می‌شد ولی اینترنت کار نمی‌کرد یا سرویس می‌افتاد.
- Root cause: the config handed to libv2ray had **no `tun` inbound**. libv2ray only passes the tunnel fd through the `xray.tun.fd` environment variable, so nothing read the packets and `addRoute("0.0.0.0", 0)` black-holed all traffic — the app looked "connected" while nothing worked, or the service died.
- حالا `ConfigBuilder.buildVpn()` یک inbound با `protocol: "tun"` (name/mtu/userLevel) + مسیریابی IP-محور می‌سازد: رنج‌های خصوصی/لوپ‌بک/IPv6 محلی DIRECT و بقیه از تونل — **بدون هیچ وابستگی به geoip/geosite**. سوکت‌های خود هسته هم با `addDisallowedApplication` از تونل بیرون نگه داشته می‌شوند تا حلقه تشکیل نشود.
- `ConfigBuilder.buildVpn()` now emits a `protocol: "tun"` inbound (name/mtu/userLevel) plus IP-based routing: private/loopback/local-IPv6 ranges go DIRECT, everything else through the tunnel — **with no dependency on geoip/geosite**. The core's own sockets are kept out with `addDisallowedApplication`, so nothing loops back in.
- ترتیب درست سرویس: اول `startForeground` (در API 34+ با نوع `specialUse`)، بعد کار. و قبل از استارت، جریان اجازه‌ها: اعلان (اندروید ۱۳+) ← دیالوگ سیستمی `VpnService.prepare()` ← `startForegroundService`. رد کردن هرکدام پیام بومی‌شده می‌دهد، نه تونل خراب.
- Correct service order: `startForeground` first (API 34+ `specialUse` type), then the work. And before starting, the permission flow: notifications (Android 13+) → the system `VpnService.prepare()` dialog → `startForegroundService`. Denying either shows a localised message instead of a broken tunnel.
- پیام خطا هرگز متن خام هسته یا جزئیات سرور را نشان نمی‌دهد («vpn_failed» + نام کلاس استثنا)؛ کانال اعلان برای API 24/25 گارد شد؛ کپی geo assetها best-effort شد.
- Error messages never expose raw core text or server details («vpn_failed» + the exception class); notification channels are now guarded for API 24/25; copying geo assets is best-effort.
- **۷ تست واحد جدید** (`ConfigBuilderTest`) همین‌ها را قفل می‌کند. / **7 new unit tests** (`ConfigBuilderTest`) lock all of this in.

## ☀️ قابلیت روز / The day feature

- **پوستهٔ روز در اپ:** تنظیمات → پوسته (تاریک/روشن). تاریک پیش‌فرض است و یک شیٔ کامل `theme-light.css` همهٔ سطح‌های تیره (تایتل‌بار، سایدبار، استاتوس‌بار، مودال، ورودی‌ها، لاگ‌ها، دیسک پاور، اسکرول‌بار، شبکهٔ متحرک) را معکوس و رنگ‌ها را برای خوانایی روی سفید تنظیم می‌کند. رنگ پس‌زمینهٔ پنجره هم از تنظیمات خوانده می‌شود تا فلش سیاه نبینید.
- **Day theme in the app:** Settings → Theme (dark/light). Dark stays the default and a full `theme-light.css` inverts every dark surface (titlebar, sidebar, statusbar, modal, inputs, logs, the power disc, scrollbars, the animated grid) and retunes colours for readability on white. The window background comes from settings, so there is no black flash at launch.
- **در سایت:** دکمهٔ ☀️/🌙 در هدر هر پنج صفحه، ذخیره در localStorage و به‌روزرسانی `theme-color`. / **On the website:** a ☀️/🌙 toggle in the header of all five pages, persisted in localStorage and reflected in `theme-color`.
- **در اندروید:** تنظیمات → روز/شب با `lightColorScheme` و معکوس‌شدن نوار وضعیت/ناوبری. / **On Android:** Settings → Day/Night with a `lightColorScheme` that also flips the system bars.

## 📊 آمار روزانه / Daily stats

- **اپ:** کارت «امروز» در صفحهٔ آمار — دقیقه‌های اتصال امروز (جلسهٔ باز تا همین لحظه شمرده می‌شود)، تعداد جلسه‌ها، بهترین و میانگین سرعت امروز و درصد تغییر نسبت به دیروز؛ با پنجرهٔ تقویمی محلی (نه گام ۲۴ ساعته) تا تغییر ساعت تابستانی روز را جابه‌جا نکند.
- **App:** a "Today" card on the Stats page — minutes connected today (open sessions counted up to now), session count, today's best and average speed, and the change against yesterday; calendar-based local windows (not fixed 24h steps) so DST cannot shift the day.
- **سایت:** هر تست سرعت به‌صورت محلی ذخیره می‌شود و نمودار «هفت روز اخیر روی این دستگاه» بهترین سرعت هر روز را با ارقام بومی‌شده + دکمهٔ پاک‌کردن نشان می‌دهد.
- **Website:** every speed test is stored locally and a "last seven days on this device" chart shows each day's best speed with localised digits plus a clear-history button.

## 🧰 ابزارها داخل اپ / Tools inside the app

- صفحهٔ جدید **ابزارها** در ناوبری: اعتبارسنج کانفیگ کاملاً client-side (vless/vmess/trojan/ss، IPv6، UUID، پورت، network ناشناخته، pbk برای REALITY، sni، serviceName برای gRPC، هشدار flow برای VLESS+TLS+TCP) با فیلدهای پوشیده — credential کامل هرگز رندر نمی‌شود.
- A new **Tools** page in the sidebar: a fully client-side validator (vless/vmess/trojan/ss, IPv6, UUID, port, unknown network, REALITY pbk, sni, gRPC serviceName, the VLESS+TLS+TCP flow hint) with masked fields — a full credential is never rendered.
- **ساخت QR** از لینک (کتابخانهٔ `qrcode`، بیلد مرورگری — بدون سرویس بیرونی) و گزینهٔ «استفاده از یکی از سرورهای من» که لینک را فقط برای کشیدن QR باز می‌کند و متن خام را در صفحه تایپ نمی‌کند. Ctrl/Cmd+Enter هم اعتبارسنجی می‌کند.
- **QR building** from a link (the `qrcode` package's browser build — no external service) plus "use one of my servers", which reveals a link only to draw the code and never prints it. Ctrl/Cmd+Enter validates too.

## 🖱️ دکمه‌ها و ریسپانسیو / Buttons & responsiveness

- **صفحهٔ خانه در انگلیسی دیگر جابه‌جا نمی‌شود:** ارتفاع ثابت ردیف دکمه‌ها + `min-width` (۱۲۸px ثانوی، ۱۷۲px اصلی) تا برچسب‌های بلند انگلیسی چیدمان را تکان ندهند.
- **The Home screen no longer shifts in English:** a fixed action-row height plus minimum widths (128px secondary, 172px primary) so longer English labels cannot move the layout.
- زیر ۸۶۰px سایدبار اپ به ریل آیکونی تبدیل می‌شود (تایتل‌بار/استاتوس‌بار/هدر صفحه هم جمع‌وجور) و زیر ۶۲۰px دکمه‌های هیرو تمام‌عرض، زیرآمارها تک‌ستونه و مودال باریک‌تر می‌شوند.
- Below 860px the app sidebar becomes an icon rail (with a compact titlebar, statusbar and page head) and below 620px the hero buttons go full width, the sub-stats become one column and modals get narrower.
- سایت: دکمه‌ها `min-height` لمسی گرفتند، برای عرض ≤۴۰۰px هدر روی یک خط می‌ماند (نام برند مخفی، دکمه‌های زبان/پوسته/منو جمع‌وجور) و تأکید بولد پاراگراف‌های آموزشی در انگلیسی هم حفظ می‌شود.
- Website: buttons gained a touch-friendly `min-height`, at ≤400px the header stays on one line (brand text hidden, language/theme/menu buttons compact) and the bold emphasis in the explainer paragraphs now survives the English switch.

## 🧪 تست‌ها / Tests

- **۷۱ تست** (از ۵۷): ۴۸ تست smoke — شامل ۷ تست جدید برای `inspectLink` و ۳ تست برای `summarizeToday` — به‌علاوهٔ ۲۳ تست DOM وب‌سایت که ۴ تای آن‌ها جدید است (پوستهٔ روز و تاریخچهٔ سرعت). اندروید هم ۷ تست واحد جدید دارد.
- **71 tests** (up from 57): 48 smoke tests — including 7 new ones for `inspectLink` and 3 for `summarizeToday` — plus 23 website DOM tests, 4 of them new (the day theme and the speed history). Android gained 7 new unit tests too.

## 📦 دانلود / Downloads

| فایل / File | برای / For |
|---|---|
| `Naxlo-Setup-1.15.0.exe` | ویندوز — نصب‌کنندهٔ نسخهٔ اصلی / Windows main installer |
| `Naxlo-Portable-1.15.0.exe` | ویندوز — پرتابل / Windows portable |
| `Naxlo-Rust-Setup-1.15.0.exe` | ویندوز — نسخهٔ سبک Rust / Windows lean Rust edition |
| `Naxlo-Rust-v1.15.0-linux-amd64.AppImage` / `.deb` | لینوکس / Linux |
| `Naxlo-Rust-v1.15.0-macos-arm64.dmg` | مک (Apple Silicon) / macOS |
| `Naxlo-android-v1.15.0-debug.apk` / `-unsigned.apk` | اندروید / Android |
| `naxlo-website.zip` | کل وب‌سایت آمادهٔ cPanel / full cPanel-ready website |

همهٔ فایل‌ها با `SHA256SUMS.txt` و checksum تکی. / Every asset ships with `SHA256SUMS.txt` plus per-file checksums.

## 🧾 یادداشت‌ها / Notes

- اندروید: versionCode 2105 / versionName 1.15.0. اگر پیش‌تر نسخهٔ debug را نصب کرده‌اید، روی همان نصب قابل به‌روزرسانی است. / Android: versionCode 2105 / versionName 1.15.0; the debug APK upgrades in place over an older debug install.
- پوستهٔ پیش‌فرض در همهٔ پلتفرم‌ها همان تاریکِ تقریباً مشکی است؛ حالت روز opt-in است. / Every platform still defaults to the near-black dark theme; day mode is opt-in.
- وب‌سایت: `vpn.naxlo.ir` — zip جدید در همین ریلیز و در Google Drive. / Website: `vpn.naxlo.ir` — the new zip ships in this release and on Google Drive.
