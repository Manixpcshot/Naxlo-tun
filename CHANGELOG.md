# Changelog / تغییرات

All notable changes to Naxlo are documented here. Releases are cut per tag
(`v*`) and every published change ships as its own GitHub release.

The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [1.15.2] - 2026-11-11

### Fixed
- **رمز trojan که `@` دارد دیگر آدرس سرور را خراب نمی‌کند (اپ، اندروید، اعتبارسنج داخل اپ و سایت).** برش اعتبارنامه در سه جا روی **نخستین** `@` انجام می‌شد، پس لینکی مثل `trojan://p@ss@host:443` به آدرس `ss@host` و پورت نامعتبر تبدیل می‌شد و کاربر خطای «پورت معتبر نیست» می‌دید درحالی‌که خود اپ درست وصل می‌شد (پارسر دسکتاپ از `lastIndexOf` استفاده می‌کرد). حالا هر چهار پارسر/اعتبارسنج اعتبارنامه را در **واپسین `@` پیش از query** قطع می‌کنند و یک `@` رمزنگاری‌نشده داخل query (مثلاً `?path=/@ws`) دیگر به‌عنوان جداکننده اشتباه گرفته نمی‌شود — پیش‌تر همان لینک در پارسر دسکتاپ یک سرور با آدرس `@ws` می‌ساخت.
- **A trojan password containing `@` no longer corrupts the server address (app, Android, in-app validator, website).** Three of the four parsers cut the credential at the **first** `@`, so `trojan://p@ss@host:443` became the address `ss@host` with an "invalid port" error, while the desktop parser (which used `lastIndexOf`) connected fine. All four now cut at the **last `@` before the query**, and an unencoded `@` inside the query (`?path=/@ws`) is no longer mistaken for the separator — such a link used to produce a server whose address was `@ws` even in the desktop parser.
- **صفحهٔ آمار زنده شد.** صفحه با دادهٔ لحظهٔ باز شدن رندر می‌ماند: کارت «امروز» که طبق توضیحش جلسهٔ باز را هم می‌شمارد، در طول یک اتصال زنده تکان نمی‌خورد، و نمودار ۱۴ روزه جلسهٔ در حال اجرا را کامل نادیده می‌گرفت (برخلاف کارت بالایش). حالا جلسهٔ باز در هر دو تا «همین لحظه» شمرده می‌شود، صفحه هر ۱۰ ثانیه هنگام اتصال (و ۶۰ ثانیه در حالت بی‌کار) بی‌صدا vault را دوباره می‌خواند — بدون busy flag و بدون toast — و سطل‌های روزانه نیمه‌شب بدون بارگذاری مجدد جابه‌جا می‌شوند.
- **The Stats page is live now.** It rendered whatever it read at mount: the "Today" card — whose own description says it includes the open session — never moved during a live session, and the 14-day chart ignored the running session entirely, contradicting the card above it. The open session now counts up to `now` in both, the page silently re-reads the vault every 10 s while connected (60 s when idle) with no busy flag and no toast, and the day buckets roll over at midnight without a reload.
- **تغییر پورت‌های محلی در حالت متصل، تونل را بازسازی می‌کند.** پیش‌تر عوض‌کردن SOCKS/HTTP هنگام اتصال فقط عدد داخل UI را عوض می‌کرد؛ هستهٔ در حال اجرا روی همان پورت‌های قبلی می‌ماند و هیچ‌کس روی پورت جدید پاسخ نمی‌داد. حالا (هم در نسخهٔ Electron و هم در نسخهٔ Rust/Tauri) تونل با پورت‌های جدید برقرار می‌شود، با یک debounce ۹۰۰ میلی‌ثانیه‌ای تا تایپ‌کردن پورت رقم‌به‌رقم باعث قطع‌وصل پشت‌سرهم نشود.
- **Changing the local ports while connected rebuilds the tunnel.** Editing SOCKS/HTTP during a session used to change only the number shown in the UI: the running core kept the old ports and nothing answered on the new ones. Both the Electron app and the Rust/Tauri edition now rebuild the tunnel on the new ports, debounced by 900 ms so typing a port digit by digit cannot trigger a reconnect per keystroke.
- **کلید «پروکسی سیستم» در حالت متصل بلافاصله اثر می‌کند.** این تنظیم فقط هنگام ساخت تونل خوانده می‌شد؛ یعنی روشن‌کردنش تا اتصال بعدی هیچ اثری نداشت و خاموش‌کردنش پروکسی را تا قطع‌شدن روی ویندوز باقی می‌گذاشت. حالا در همان لحظه اعمال یا آزاد می‌شود (بدون دست‌زدن به هستهٔ در حال اجرا)، و در نسخهٔ Rust هم معادل‌سازی شد.
- **The "apply system proxy" switch now takes effect immediately while connected.** The setting was only read when the tunnel was built, so turning it on did nothing until the next reconnect and turning it off left the Windows proxy pointing at Naxlo until disconnect. It is applied or released on the spot now (the running core is untouched), and the Rust edition got the same behaviour.
- **پیام «این کانفیگ پشتیبانی نمی‌شود» در حالت انگلیسی/ترکی فارسی بود.** `unsupportedReason` یک رشتهٔ فارسی خام بود و `validateConfig` همان متن را به‌عنوان **هر دو** زبان به `L(reason, reason)` می‌داد؛ نتیجه: اتصال به یک کانفیگ پشتیبانی‌نشده (مثلاً `ss://`) در حالت انگلیسی با پیام فارسی شکست می‌خورد و کارت سرور هم همان دلیل فارسی را در حالت EN/TR نشان می‌داد. حالا دلیل به‌صورت `{fa, en, tr}` ذخیره و نمایش داده می‌شود (ورودی‌های قدیمی vault که رشتهٔ ساده‌اند هنوز درست رندر می‌شوند) و جدول ترکی هم کامل شد.
- **"This config is not supported" was Persian in English/Turkish mode.** `unsupportedReason` was a bare Persian string and `validateConfig` passed that same text as **both** languages (`L(reason, reason)`), so connecting to an unsupported config (an `ss://` link, say) failed with a Persian message in English mode — and the server card showed the same Persian reason in EN/TR. The reason is now stored and rendered as `{fa, en, tr}` (vault entries written by older releases, which are plain strings, still render), with Turkish coverage added to both translation tables.
- **اعتبارسنج سایت فرمت vmess v2 را نادیده می‌گرفت.** برای `net:"ws"` هیچ فیلد `path` نمایش داده نمی‌شد، برای gRPC نبودِ `serviceName` بررسی نمی‌شد و `sni`/`host` هم نشان داده نمی‌شد؛ ضمن اینکه رمز trojan اعتبارسنجی می‌شد ولی هرگز به‌صورت یک چیپ پوشیده نمایش داده نمی‌شد. حالا همهٔ این فیلدها دقیقاً مثل پارسر اپ خوانده و پوشیده نمایش داده می‌شوند.
- **The website validator ignored the vmess v2 transport.** A `net:"ws"` config showed no `path`, a missing gRPC `serviceName` was never flagged and `sni`/`host` were not reported; the trojan password was validated but never displayed. All of these fields are now read exactly like the app's parser reads them and shown masked.
- **نتیجهٔ اعتبارسنجی سایت بعد از تعویض زبان به زبان قبلی می‌ماند.** اگر در فارسی اعتبارسنجی می‌کردید و سپس انگلیسی را می‌زدید، همان «کانفیگ معتبر است» فارسی روی صفحهٔ انگلیسی می‌ماند (نقیض قاعدهٔ «در حالت انگلیسی هیچ متن فارسی نماند»). حالا `applyLang` یک رویداد `naxlo:lang` منتشر می‌کند و صفحهٔ ابزارها نتیجهٔ موجود و دکمهٔ «بفرست به اعتبارسنجِ» خوانده‌شده از QR را دوباره در زبان فعال می‌سازد.
- **A validation result on the website stayed in the previous language.** Validate in Persian, switch to English, and the same Persian "the config is valid" line remained on an English page — against the project's own "no Persian text in English mode" rule. `applyLang` now dispatches a `naxlo:lang` event and the tools page re-renders the existing result plus the QR reader's "Send to validator" button in the active language.
- **پوستهٔ روز: اسکرول‌بار در فایرفاکس نامرئی بود.** `theme-light.css` فقط شبه‌عنصرهای webkit را معکوس می‌کرد و `scrollbar-color: rgba(255,255,255,.14)` که فایرفاکس می‌خواند دست‌نخورده مانده بود — یعنی اسکرول‌بار سفید روی پس‌زمینهٔ سفید. / **Day theme: the scrollbar was invisible in Firefox.** `theme-light.css` only overrode the webkit pseudo-elements; the `scrollbar-color` Firefox reads was left white-on-white and is now darkened for light mode.
- **اندروید: متن تنظیمات با TUN واقعی تناقض داشت.** صفحهٔ تنظیمات هنوز می‌گفت «بدون TUN سیستمی: تونل فقط داخل sandbox» و پورت‌های `SOCKS5 127.0.0.1:10808 · HTTP 127.0.0.1:10809` را نشان می‌داد — درحالی‌که از ۱٫۱۵٫۰ کلاینت از VPN خود اندروید با یک inbound از نوع `tun` استفاده می‌کند و آن پورت‌ها اصلاً باز نمی‌شوند. متن‌ها در هر سه زبان با توصیف درست جایگزین شدند.
- **Android: the settings copy contradicted the working tunnel.** The screen still claimed "No system TUN: the tunnel lives inside the Android sandbox" and advertised `SOCKS5 127.0.0.1:10808 · HTTP 127.0.0.1:10809`, although since 1.15.0 the client runs Android's own VPN with a `tun` inbound and opens no such ports. The strings were rewritten in all three languages.
- **CI: آپلود دارایی‌های انتشار دیگر با یک خطای گذرا شکست نمی‌خورد.** کار «Attach website deployment zip» چند ثانیه بعد از push تگ تمام می‌شود و اگر `uploads.github.com` یک بار connection را قطع کند (یا انتشار draft هنوز ساخته نشده باشد) کل انتشار بدون `naxlo-website.zip` می‌ماند — بدون امکان re-run با توکن کاری. حالا هر دو مرحلهٔ آپلود (zip سایت و installerهای ویندوز) تا ۹/۶ بار با فاصلهٔ ۲۰ ثانیه تلاش می‌کنند.
- **CI: a transient upload error no longer costs the release assets.** The "Attach website deployment zip" job finishes seconds after the tag push, so a single dropped connection from `uploads.github.com` (or a draft release that does not exist yet) left the whole release without `naxlo-website.zip` — with no way to re-run the job using the workflow token. Both upload steps (the website zip and the Windows installers) now retry up to 9/6 times, 20 s apart.
- **باگ در خود تست‌ها:** بررسی پوشش ترکی گروه اشتباهی از regex را می‌خواند (`match[6]` به‌جای `match[7]`)، پس آرگومان سوم صریح `L(fa, en, tr)` هرگز تشخیص داده نمی‌شد — و برای رشته‌های انگلیسی داخل `"..."` آخرین کاراکتر متن به‌جای «ویرگول» خوانده می‌شد و کنترل ترجمه بی‌صدا رد می‌شد. / **A bug in the tests themselves:** the Turkish-coverage scanner read the wrong capture group (`match[6]` instead of `match[7]`), so an explicit `L(fa, en, tr)` third argument was never detected — and for double-quoted English strings the last character of the text was read as the "has Turkish" flag, silently skipping the check.

### Added
- **۸ تست جدید محلی (۸۲ = ۵۲ smoke + ۳۰ DOM وب‌سایت)** که هر باگ را قفل می‌کنند: شمارش جلسهٔ باز تا «حالا» در `aggregateStats` و توافقش با کارت «امروز»، جلسهٔ تازه‌شروع با `endedAt: 0`، `@` داخل query در پارسر دسکتاپ، دلیل بومی‌شدهٔ کانفیگ پشتیبانی‌نشده (بدون هیچ کاراکتر فارسی در `en`)، `inspectLink` با رمز trojan دارای `@`، و در سمت سایت: رمز trojan با `@`، `@` داخل query، فیلدهای vmess v2 (path/serviceName/sni) و بازسازی نتیجهٔ اعتبارسنجی با تعویض زبان.
- **8 new local tests (82 = 52 smoke + 30 website DOM)** locking every fix: the open session counting up to `now` in `aggregateStats` and agreeing with the "Today" card, a freshly started session with `endedAt: 0`, an `@` inside the query in the desktop parser, a localized unsupported-config reason (with no Persian characters left in `en`), `inspectLink` on a trojan password containing `@`, and on the website side: the trojan `@` password, the query `@`, the vmess v2 fields (path/serviceName/sni) and the validator result following a language switch.
- **۲ تست واحد اندروید (`ParseTest`)** برای رمز trojan با `@` و `@` داخل query — جمعاً **۱۳ تست واحد اندروید** در CI. / **2 Android unit tests (`ParseTest`)** for a trojan password with `@` and an `@` inside the query — **13 Android unit tests** in CI in total.

### Changed
- اندروید: versionCode 2107 و versionName 1.15.2. / Android bumped to versionCode 2107 / versionName 1.15.2.

## [1.15.1] - 2026-11-10

### Fixed
- **سایت: برای بازدیدکنندهٔ انگلیسی‌زبان کل جاوااسکریپت از کار می‌افتاد.** `applyLang()` هنگام بالاآمدن صفحه (وقتی زبان ذخیره‌شده `en` بود) قبل از مقداردهی ثابت‌های هم‌دامنه اجرا می‌شد و `renderReleases()` به `const relRoot` می‌رسید؛ نتیجه `ReferenceError: Cannot access 'relRoot' before initialization` بود که بقیهٔ اسکریپت را قطع می‌کرد — یعنی دکمهٔ پوسته، منوی همبرگری، اعتبارسنج، QR، گرید دانلود و صفحهٔ تغییرات برای کسی که یک بار انگلیسی را انتخاب کرده بود کار نمی‌کردند (باگ از قبل وجود داشت و فقط در «بازدید مجدد با زبان ذخیره‌شده» ظاهر می‌شد، برای همین تست‌های قبلی که بعد از بارگذاری کلیک می‌کردند آن را نمی‌دیدند). حالا بخش boot به انتهای دامنه منتقل شده تا همهٔ ثابت‌ها مقدار گرفته باشند.
- **Website: the whole script died for returning English visitors.** At boot, when the saved language was `en`, `applyLang()` ran before the consts in its own scope were initialised, so `renderReleases()` hit `const relRoot` and threw `ReferenceError: Cannot access 'relRoot' before initialization` — aborting the rest of app.js. The theme toggle, burger menu, validator, QR, download grid and changelog therefore never wired up for anyone who had picked English once (the bug pre-dates this release and only showed on a *return* visit with a stored language, which is why the existing tests — they click after load — never saw it). The boot block now runs last, after every const exists.
- **سایت: برچسب دسترسی دکمهٔ پوسته با تعویض زبان به‌روز می‌ماند.** زبان پیش‌فرض فارسی است، پس `aria-label`/`title` دکمهٔ ☀️/🌙 فارسی ساخته می‌شد («حالت روز») و بعد از تعویض به انگلیسی همان برچسب فارسی می‌ماند — یک متن فارسی در حالت انگلیسی (در درخت دسترس‌پذیری). حالا با هر تعویض زبان برچسب هم بازسازی می‌شود، و این بازسازی طوری گارد شده که انتخاب «روز» کاربر را در نخستین اجرا با «شب» جایگزین نکند. / **Website: the theme toggle's accessibility label stayed behind on language switch.** Persian is the default, so the ☀️/🌙 button's `aria-label`/`title` was built in Persian and remained Persian after switching to English — a Persian string in English mode (in the accessibility tree). Every language switch now rebuilds the label, guarded so it cannot overwrite a saved day-theme choice during the first paint.

### Added
- **۳ تست DOM جدید** که هر دو باگ را قفل می‌کنند: برچسب دکمهٔ پوسته با تعویض زبان، ماندگاری پوستهٔ روز در بارگذاری نخست با زبان انگلیسی، و «بازدیدکنندهٔ انگلیسی‌زبانِ بازگشتی صفحهٔ کاملاً سیم‌کشی‌شده می‌گیرد» (اعتبارسنج + منوی همبرگری + پوسته). جمعاً **۷۴ تست**. / **3 new DOM tests** locking both bugs: the toggle label following the language switch, a saved day theme surviving an English first paint, and "a returning English visitor gets a fully wired page" (validator + burger menu + theme). **74 tests** in total.

### Changed
- اندروید: versionCode 2106 و versionName 1.15.1. / Android bumped to versionCode 2106 / versionName 1.15.1.

## [1.15.0] - 2026-11-10

### Fixed
- **اندروید: اتصال واقعاً برقرار می‌شود.** ریشهٔ مشکل این بود که کانفیگ داده‌شده به libv2ray هیچ `tun` inbound نداشت: libv2ray فقط fd تونل را از طریق متغیر محیطی `xray.tun.fd` به هسته می‌دهد، پس بدون inbound از نوع `tun` هیچ‌کس بسته‌ها را نمی‌خواند و `addRoute("0.0.0.0", 0)` همهٔ ترافیک را به سیاه‌چاله می‌برد (ضمن اینکه سوکت‌های خود هسته هم بدون `addDisallowedApplication` دوباره داخل تونل می‌پیچیدند). حالا `ConfigBuilder.buildVpn()` یک inbound با `protocol: "tun"` (name/mtu/userLevel) می‌سازد، مسیریابی IP-محور با DIRECT برای رنج‌های خصوصی/لوپ‌بک/IPv6 محلی و catch-all برای بقیه، و هیچ وابستگی‌ای به geoip/geosite ندارد. سرویس هم اول `startForeground` می‌شود (API 34+ با `specialUse`) و بعد کار را شروع می‌کند، تا سرویس بدون `startForeground` کشته نشود.
- **Android: connecting actually works now.** The config handed to libv2ray had no `tun` inbound: libv2ray only passes the tunnel fd through the `xray.tun.fd` environment variable, so nothing read the packets and `addRoute("0.0.0.0", 0)` black-holed all traffic (the core's own sockets also looped back in without `addDisallowedApplication`). `ConfigBuilder.buildVpn()` now emits a `protocol: "tun"` inbound (name/mtu/userLevel), IP-based routing with DIRECT for private/loopback/local-IPv6 ranges plus a catch-all, and no dependency on geoip/geosite. The service also calls `startForeground` first (API 34+ `specialUse`) and only then does any work, so it can no longer be killed before reaching `startForeground`.
- **اندروید: جریان اجازه‌ها قبل از اتصال.** پیش از این سرویس ممکن بود بدون رضایت `VpnService.prepare()` استارت بخورد و `establish()` مقدار null برگرداند. حالا `rememberVpnConnect()` به‌ترتیب درخواست اعلان (اندروید ۱۳+)، دیالوگ سیستمی VPN و سپس `startForegroundService` را انجام می‌دهد؛ اگر کاربر رد کند پیام بومی‌شدهٔ «vpn_denied» می‌بیند و اگر هسته خطا بدهد «vpn_failed (نام کلاس)» — بدون اینکه متن خام هسته یا جزئیات سرور نشت کند. / **Android: the permission flow runs before connecting.** The service could previously be started without `VpnService.prepare()` consent, so `establish()` returned null. `rememberVpnConnect()` now walks the notification prompt (Android 13+), the system VPN dialog and only then `startForegroundService`; a denial shows the localised «vpn_denied», and a core failure shows «vpn_failed (ExceptionClass)» — never raw core text or server details.
- **اندروید: کانال اعلان برای API 24/25 گارد شد** (minSdk 24 ولی `NotificationChannel` از API 26 است) و کپی geo assetها best-effort شد تا نبود/خرابی فایل دارایی هرگز اتصال را شکست ندهد. CI هم دارایی‌ها را با `curl -fsSL`، بررسی magic bytes و حداقل حجم می‌گیرد تا body خطا جای geoip.dat ننشیند. / **Android: notification channels are guarded for API 24/25** (minSdk is 24 but `NotificationChannel` is API 26+) and copying the geo assets is best-effort, so a missing asset can never fail a connection. CI now fetches assets with `curl -fsSL` plus magic-byte and minimum-size checks, so an error body can no longer be saved as `geoip.dat`.
- **انگلیسی: جابه‌جایی دکمه‌ها در صفحهٔ خانه.** برچسب‌های بلندتر انگلیسی چیدمان هیرو را جابه‌جا می‌کردند؛ حالا جای دکمه‌ها با `min-width` ثابت (۱۲۸px برای ثانوی، ۱۷۲px برای اصلی) و ارتفاع ثابت ردیف، در هر دو زبان و هنگام تعویض زبان تکان نمی‌خورد. / **English: buttons no longer shift on the Home screen.** Longer English labels used to move the hero layout; the action row now has a fixed height and stable minimum widths (128px secondary, 172px primary), so nothing jumps between languages or while switching.
- **انگلیسی در سایت: تأکید بولد در پاراگراف‌های آموزشی حفظ می‌شود.** پیش‌تر تعویض زبان کل `textContent` را جایگزین می‌کرد و `<b>`ها از بین می‌رفتند؛ حالا این سه پاراگراف با `data-i18n-html` ترجمه می‌شوند. / **English on the website: bold emphasis survives the language switch.** Replacing `textContent` used to drop the `<b>` markup in the VPN explainer; those three paragraphs now translate through `data-i18n-html`.

### Added
- **قابلیت روز (پوستهٔ روشن) در اپ، سایت و اندروید.** در اپ: تنظیمات → پوسته، با «تاریک» به‌عنوان پیش‌فرض و یک شیٔ کامل `theme-light.css` که همهٔ سطح‌های تیرهٔ hardcode (تایتل‌بار، سایدبار، استاتوس‌بار، مودال، ورودی‌ها، لاگ‌ها، دیسک پاور، اسکرول‌بار، شبکهٔ متحرک پس‌زمینه) را معکوس می‌کند و رنگ‌های معنایی/اکسنت را به واریانت تیره‌تر و خوانا روی سفید می‌برد؛ رنگ پس‌زمینهٔ پنجرهٔ Electron هم از تنظیمات خوانده می‌شود تا هنگام اجرا فلش سیاه نبینید. در سایت: دکمهٔ ☀️/🌙 در هدر هر پنج صفحه با ذخیره در localStorage و به‌روزرسانی `theme-color`. در اندروید: تنظیمات → روز/شب با `lightColorScheme` و معکوس‌شدن نوار وضعیت/ناوبری. / **Day (light) theme in the app, on the website and on Android.** App: Settings → Theme, dark stays the default, with a complete `theme-light.css` that inverts every hardcoded dark surface (titlebar, sidebar, statusbar, modal, inputs, logs, the power disc, scrollbars, the animated background grid) and moves semantic/accent colours to their readable deep variants on white; the Electron window background is read from settings so there is no black flash at launch. Website: a ☀️/🌙 header toggle on all five pages, persisted in localStorage and reflected in `theme-color`. Android: Settings → Day/Night with a `lightColorScheme` that also flips the system bars.
- **آمار روزانه در اپ:** کارت «امروز» در صفحهٔ آمار — دقیقه‌های اتصال در روز جاری (با شمارش جلسهٔ باز تا همین لحظه)، تعداد جلسه‌ها، بهترین و میانگین سرعت امروز و درصد تغییر نسبت به دیروز. پنجره‌ها بر اساس تقویم محلی محاسبه می‌شوند (نه گام‌های ثابت ۲۴ ساعته) تا تغییر ساعت تابستانی روز را جابه‌جا نکند. / **Daily stats in the app:** a "Today" card on the Stats page — minutes connected during the current local day (open sessions counted up to now), session count, today's best and average speed and the percentage change against yesterday. Windows are calendar-based rather than fixed 24h steps, so a DST switch cannot shift the day.
- **تاریخچهٔ روزانهٔ سرعت در سایت:** نتیجهٔ هر تست سرعت به‌صورت محلی (localStorage) ذخیره می‌شود و نمودار «هفت روز اخیر روی این دستگاه» بهترین سرعت هر روز را با ارقام بومی‌شده (فارسی/انگلیسی) و دکمهٔ پاک‌کردن تاریخچه نشان می‌دهد. / **Daily speed history on the website:** every completed test is stored locally (localStorage) and a "last seven days on this device" chart shows each day's best speed with localised digits plus a clear-history button.
- **صفحهٔ «ابزارها» داخل اپ:** اعتبارسنج کانفیگ کاملاً client-side روی `src/shared/linkcheck.ts` (vless/vmess/trojan/ss، IPv6 داخل کروشه، UUID، پورت، network ناشناخته، نبود pbk برای REALITY، tls بدون sni، gRPC بدون serviceName، و هشدار flow برای VLESS+TLS+TCP) با فیلدهای پوشیده و ساخت **QR** از لینک (پکیج `qrcode`، بیلد مرورگری) — از جمله «استفاده از یکی از سرورهای من» که لینک را reveal می‌کند و فقط QR را می‌سازد بدون اینکه متن خام در صفحه تایپ شود. آیکون جدید `qr` و آیتم ناوبری `tools` هم اضافه شد. / **An in-app Tools page:** a fully client-side validator built on `src/shared/linkcheck.ts` (vless/vmess/trojan/ss, bracketed IPv6, UUID, port, unknown network, missing REALITY pbk, tls without sni, gRPC without serviceName, plus the VLESS+TLS+TCP flow hint) with masked fields, and a **QR** builder (the `qrcode` package's browser build) — including "use one of my servers", which reveals the link only to draw the code and never prints it. A new `qr` icon and `tools` nav item came with it.
- **۱۰ تست جدید:** هفت تست برای `inspectLink` (لینک سالم REALITY، UUID/پورت بد، اسکیم ناشناخته، پوشیدگی credentialها، vmess base64 و ss، هشدارهای sni/serviceName، IPv6 و همگام‌بودن جدول aliasها با سایت) و سه تست برای `summarizeToday` (جلسهٔ باز/بسته، فقط نمونه‌های سرعت امروز، مقایسه با دیروز) + **۴ تست DOM سایت** (حالت پیش‌فرض شب، تعویض به روز و ماندگاری آن بعد از بارگذاری مجدد، وجود دکمه در همهٔ صفحه‌ها، رندر/ارقام/پاک‌کردن تاریخچه و مخفی‌بودن آن برای بازدیدکنندهٔ جدید) — جمعاً **۷۱ تست** (۴۸ smoke + ۲۳ DOM وب‌سایت). / **10 new tests:** seven for `inspectLink` (a healthy REALITY link, bad UUID/port, unknown scheme, credential masking, vmess base64 and ss, the sni/serviceName warnings, IPv6 and alias-table agreement with the website) and three for `summarizeToday` (open/closed sessions, today-only speed samples, the day-over-day delta), plus **4 new website DOM tests** (night by default, toggling to day and surviving a reload, the toggle existing on every page, and history rendering/digits/clearing/hidden-when-empty) — **71 tests** in total (48 smoke + 23 website DOM).
- **اندروید: ۷ تست واحد جدید (`ConfigBuilderTest`)** که وجود inbound با `protocol: "tun"`، رنج‌های DIRECT، نبود `geoip:`/`geosite:` در routing، و ساختار outbound را قفل می‌کنند. / **Android: 7 new unit tests (`ConfigBuilderTest`)** locking the `protocol: "tun"` inbound, the DIRECT ranges, the absence of `geoip:`/`geosite:` in routing and the outbound shape.

### Changed
- `qrcode` به وابستگی‌های اپ اضافه شد (بیلد مرورگری؛ بدون `fs`) تا QR داخل اپ بدون سرویس بیرونی ساخته شود. / `qrcode` became an app dependency (its browser build, no `fs`) so the in-app QR needs no external service.
- اندروید: versionCode 2105 و versionName 1.15.0. / Android bumped to versionCode 2105 / versionName 1.15.0.

## [1.14.0] - 2026-11-08

### Fixed
- **جای دکمه‌ها در زبان انگلیسی درست شد:** در دیالوگ‌ها ترتیب DOM «عمل اصلی، لغو» است که در فارسی (RTL) عمل اصلی را راست‌چین می‌کند؛ در انگلیسی/ترکی همان ترتیب باعث می‌شد دکمهٔ اصلی چپ‌ترین و گروه دکمه‌ها به لبهٔ چپ بچسبد (ترتیب آینه‌شدهٔ فارسی). حالا در LTR ردیف معکوس می‌شود: «لغو» سمت چپ، عمل اصلی راست‌ترین و گروه راست‌چین — یعنی جای دکمهٔ اصلی در هر دو زبان یک طرف فیزیکی می‌ماند و کلیک اشتباه کمتر می‌شود. ردیف‌های دکمه (`btn-row`، `pagehead__actions`، `home-hero__actions`) هم `align-items: center` گرفتند تا با برچسب‌های بلند انگلیسی هم‌تراز بمانند.
- **Dialog button placement in English is fixed:** dialogs are authored "primary, cancel", which packs the primary action at the right edge in Persian (RTL) but left it leftmost, glued to the left edge, in English/Turkish. LTR now reverses the row — Cancel on the left, the primary/danger action rightmost and right-aligned — so the primary button keeps the same physical side in every language. Button rows (`btn-row`, `pagehead__actions`, `home-hero__actions`) also centre-align, which keeps mixed-height rows tidy with longer English labels.
- **جداکنندهٔ اعشاری فارسی در سایت:** `loc()` فقط ارقام را فارسی می‌کرد و نقطهٔ اعشار لاتین می‌ماند («۲۰.۰ MB»); حالا «۲۰٫۰ MB» با جداکنندهٔ ٫ مثل خود اپ — فقط وقتی رشته با عدد شروع شود تا نام فایل‌ها و متن‌ها دست‌نخورده بمانند. / **Persian decimal separator on the website:** `loc()` only converted digits, leaving a Latin dot ("۲۰.۰ MB"); it now renders ٫ like the app does, and only for strings that start with a number so file names and prose stay intact.
- **کارت‌های صفحهٔ تغییرات با تعویض زبان فارسی می‌ماندند:** چون فقط یک بار هنگام fetch ساخته می‌شدند؛ حالا مثل فهرست دانلود با هر تغییر زبان بازسازی می‌شوند (دکمهٔ «دانلود/Download»، «یادداشت انتشار/Release notes»، تعداد فایل‌ها، تاریخ و چیپ‌های وضعیت بیلد). / **Changelog cards stayed Persian after switching language** because they were built once at fetch time; like the download list they are now rebuilt on every language switch (download/release-notes buttons, asset counts, dates and the build chips).

### Added
- **سایت: تشخیص سیستم‌عامل بازدیدکننده** — کارت دانلود متناسب با سیستم شما اول می‌آید، با هالهٔ تأکیدی و برچسب «برای سیستم شما / For your system»، و دکمهٔ اصلی هیرو هم همان پلتفرم را می‌گوید («دانلود برای مک» / «Download for macOS»). / **Website: visitor OS detection** — the matching download card comes first with an accent glow and a "For your system" badge, and the hero CTA names that platform.
- **سایت: لینک فعال در ناوبری** (`aria-current` + استایل), **دکمهٔ بازگشت به بالا**, **لینک پرش به محتوا** برای کیبورد/صفحه‌خوان. / **Website: active nav link** (`aria-current` + styling), a **back-to-top button** and a **skip-to-content link** for keyboard/screen-reader users.
- **سایت: ابزارها** — اعتبارسنج با **Ctrl+Enter** هم اجرا می‌شود؛ کنار QR دکمهٔ **کپی لینک** و **دانلود QR** (SVG) اضافه شد. / **Website tools:** the validator also runs on **Ctrl+Enter**, and the QR card gained **Copy link** and **Download QR** (SVG) buttons.
- **سایت: صفحهٔ تغییرات** — هر انتشار دکمهٔ دانلود و یادداشت انتشار گرفت و چیپ‌های بیلد وضعیت را با کلمهٔ بومی‌شده نشان می‌دهند (موفق/ناموفق/در حال اجرا). / **Website changelog:** every release now has download and release-notes buttons, and the build chips spell out their state in the active language.
- **`.htaccess`:** هدر HSTS و آدرس‌های بدون پسوند (`/tools`، `/changelog`، `/speedtest`) + `sitemap.xml` با دو صفحهٔ جدید. / **`.htaccess`:** HSTS header and extensionless URLs, plus the two new pages in `sitemap.xml`.
- **۹ تست DOM جدید (jsdom) با fetch ساختگی GitHub:** رندر گرید دانلود، اولویت/برچسب سیستم بازدیدکننده، بومی‌سازی اندازه‌ها و جداکنندهٔ اعشاری، CTA هیرو، دکمهٔ بازگشت به بالا، لینک فعال ناوبری، Ctrl+Enter، رندر تغییرات + چیپ‌ها و باز-برچسب‌گذاری آن‌ها در EN، و یک تست که sitemap/.htaccess/قاعدهٔ LTR دیالوگ را قفل می‌کند — جمعاً **۱۸ تست وب‌سایت**. / **9 new jsdom DOM tests with a stubbed GitHub fetch:** download-grid rendering, visitor-OS ordering/badge, size and decimal localisation, hero CTA, back-to-top, active nav, Ctrl+Enter, changelog rendering + chips and their EN relabelling, plus a test locking sitemap/.htaccess/the LTR dialog rule — **18 website tests** in total.

### Changed
- اندروید: versionCode 2104 و versionName 1.14.0. / Android bumped to versionCode 2104 / versionName 1.14.0.

## [1.13.0] - 2026-11-07

### Added
- **ابزارها در وب‌سایت (`tools.html`):** اعتبارسنج کانفیگ کاملاً client-side (vless/vmess/trojan/ss با همان قاعده‌های پارسر اپ: UUID، پورت، network ناشناخته، pbk واقعی برای REALITY، SNI، serviceName برای gRPC…) با نمایش فیلدهای پارشده به‌صورت پوشیده (هرگزcredential کامل نشان داده نمی‌شود) + تبدیل **لینک ↔ QR** (ساخت QR از لینک برای اسکن موبایل و خواندن متن از تصویر QR با ارسال مستقیم به اعتبارسنج). هیچ چیز آپلود نمی‌شود.
- **Website tools page:** fully client-side config validator (vless/vmess/trojan/ss with the app's own parse rules: UUID, port, unknown network, REALITY pbk, SNI, gRPC serviceName…) showing parsed fields masked (full credentials never rendered) + **link ↔ QR** (build a QR from a link for phone scanning, and read a QR image back straight into the validator). Nothing is uploaded.
- **صفحهٔ تغییرات زنده (`changelog.html`):** تاریخچهٔ انتشارها مستقیم از API گیت‌هاب (متن ریلیز با رندر سبک مارک‌داون) + نوار وضعیت بیلد سه ورک‌فلو (Release/Android/tauri) روی آخرین تگ با چراغ سبز/قرمز/در‌حال‌اجرا.
- **Live changelog page:** release history straight from the GitHub API (light markdown rendering) + a build-status strip for the three workflows (Release/Android/tauri) on the latest tag with green/red/running chips.
- **تست‌های DOM وب‌سایت (jsdom):** ۹ تست جدید در `npm test` که صفحه‌ها را در jsdom بار می‌کنند و کلید زبان/fa-EN (شامل شمارهٔ قدم‌ها و title/meta)، اعتبارسنج و fallbackهای بدون API را گارانتی می‌کنند. / **Website DOM tests (jsdom):** 9 new tests in `npm test` load the pages in jsdom and guarantee the fa/EN switch (including step numerals and title/meta), the validator and the no-API fallbacks.

### Fixed
- **اعداد در اپ واقعاً یکدست شدند:** کاشی‌های صفحهٔ آمار از `formatMinutes` مشترک استفاده می‌کردند که حتی در فارسی/ترکی «1h 2m» لاتین می‌ساخت؛ اکنون `minutesLabel` در format.ts واحد و ارقام را بر اساس زبان می‌سازد (فا: «۱ ساعت و ۲ دقیقه»، tr: «1 sa 2 dk») + تست regression جدید که ارقام fa/en/tr را قفل می‌کند. وب‌سایت هم در حالت فارسی اعداد لاتین نشان می‌داد (حجم کارت‌های دانلود، گیج تست سرعت، MB/ثانیه) که اکنون با `loc()` فارسی می‌شوند و در EN کاملاً لاتین می‌مانند.
- **Digits are finally consistent in the app:** the stats tiles used the shared `formatMinutes` which rendered Latin "1h 2m" even in Persian/Turkish; a new `minutesLabel` in format.ts builds units and digits per language (fa: «۱ ساعت و ۲ دقیقه», tr: «1 sa 2 dk») plus a regression test locking fa/en/tr digits. The website also showed Latin digits in fa mode (download-card sizes, speed gauge, MB/seconds) which now localise via `loc()` while EN stays fully Latin.
- **رسپانسیو موبایل سایت:** منوی دسکتاپ در <۹۴۰px پنهان می‌شد و راه ناوبری نبود؛ حالا دکمهٔ همبرگری با پنل کشویی، حلقه‌های هیرو و آیکن با `min()` مقیاس می‌گیرند، گیج/تونل/کارت‌ها در <۶۰۰px جمع‌وجور می‌شوند و دکمه‌ها تمام‌عرض می‌شوند. / **Mobile responsiveness:** below 940px the nav used to disappear entirely; now a burger button opens a dropdown panel, hero rings/icon scale with `min()`, and under 600px the gauge/tunnel/cards compact and buttons go full-width.

### Changed
- اندروید: versionCode 2103 و versionName 1.13.0. / Android bumped to versionCode 2103 / versionName 1.13.0.
- `jsdom` به devDependencies اضافه شد (فقط برای تست‌ها). / `jsdom` added to devDependencies (tests only).

## [1.12.0] - 2026-11-07

### Added
- **تست سرعت تطبیقی مثل speedtest.net (هر سه سطح: اپ الکترون، نسخهٔ Rust و وب‌سایت):** یک پروب تک‌جریانی ۲ مگابایتی اول خط را می‌سنجد؛ بعد حجم اصلی از یک نردبان (۸/۱۶/۳۲/۶۴/۱۰۰ مگابایت) طوری انتخاب می‌شود که پنجرهٔ اندازه‌گیری ~۸ ثانیه پر بماند؛ **۴ جریان هم‌زمان** می‌کشند (خط‌های گیگابیتی دیگر به یک TCP محدود نمی‌شوند) و نرخ نهایی فقط از **پنجرهٔ پایدار پس از رمپ‌آپ ۱٫۵ ثانیه‌ای** حساب می‌شود — یعنی خط قوی دیگر عدد کم‌تری از واقعیت نمی‌بیند. منبع‌ها به ترتیب: سایت خود پروژه (فایل استاتیک ۱۰ مگابایتی + مولد on-demand جدید `speedtest.php?bytes=N` تا ۲۵۰MB)، سپس Cloudflare (`__down?bytes=N`) و آینهٔ tele2 (۱۰/۲۰/۵۰/۱۰۰MB).
- **Adaptive speedtest.net-style measurement (Electron, Rust edition and the website):** a 2 MB single-stream probe sizes the line, the main phase then picks a ladder size (8/16/32/64/100 MB) that fills an ~8 s window, **four parallel streams** pull it (gigabit lines are no longer capped by one TCP connection) and the final rate uses only the **steady-state window after a 1.5 s slow-start ramp** — fast lines finally see their real number. Sources in order: the project site (10 MB static file + the new on-demand generator `speedtest.php?bytes=N`, capped 250 MB), then Cloudflare (`__down?bytes=N`) and the tele2 mirror (10/20/50/100 MB).
- **`speedtest.php` روی سایت:** مولد بایت تصادفی فشرده‌ناپذیر با هدرهای no-store؛ `.htaccess` آن را مثل `speedtest.bin` از gzip و کش خارج می‌کند. / **`speedtest.php` on the site:** an incompressible random-byte generator with no-store headers; `.htaccess` keeps it out of gzip and caches just like `speedtest.bin`.
- صفحهٔ تست سرعت وب حالا حجم هدف و تعداد جریان را هم نشان می‌دهد و مقیاس گیج با سرعت بزرگ می‌شود (۱۰۰→۲۰۰۰ مگابیت). / The web speed-test page now shows the target size and stream count, and the gauge scale grows with the line (100→2000 Mbit/s).

### Changed
- نتیجهٔ تست سرعت حالا `sizeMb` و `streams` را هم برمی‌گرداند (در هر دو نسخهٔ دسکتاپ). / The speed-test result now also carries `sizeMb` and `streams` (both desktop editions).
- اندروید: versionCode 2102 و versionName 1.12.0. / Android bumped to versionCode 2102 / versionName 1.12.0.
- تست‌ها: ۳۷ smoke سبز (۳ تست جدید برای نردبان/نرخ پایدار/آینهٔ tele2 + تست‌های واحد Rust معادل). / 37 smoke tests green (3 new for ladder/steady-rate/tele2 mirror + matching Rust unit tests).

## [1.11.1] - 2026-11-06

### Fixed
- **رابط انگلیسی دیگر متن فارسی ندارد:** tooltip نمایش/پنهان کردن مقدار پوشیده (`Reveal`) و عنوان پیش‌فرض توست خطا («خطا») سخت‌کد فارسی بودند و در حالت انگلیسی/ترکی هم فارسی می‌ماندند؛ اکنون از دیکشنری سه‌زبانه می‌آیند (`reveal`/`hide` ترکی هم گرفتند و عنوان پیش‌فرض `L('خطا','Error','Hata')` شد).
- **The English UI no longer shows Persian strings:** the reveal/hide tooltip of masked values and the default error-toast title were hard-coded Persian and stayed Persian in English/Turkish mode; both now come from the trilingual dictionary (`reveal`/`hide` gained Turkish, default title is `L('خطا','Error','Hata')`).
- **وب‌سایت در حالت انگلیسی کاملاً انگلیسی شد:** شمارهٔ قدم‌های «سه قدم تا اتصال» (۱/۲/۳) و کل صفحهٔ ۴۰۴ فارسی می‌ماندند؛ اکنون شماره‌ها کلید i18n دارند و ۴۰۴ دوزبانه شد (با کلید زبان). عنوان و meta description هر سه صفحه هم با زبان عوض می‌شوند (پیش‌تر فقط متن بدنه عوض می‌شد و عدد/عنوان فارسی می‌ماند).
- **The website is fully English in EN mode:** the step numerals (۱/۲/۳) and the whole 404 page stayed Persian; numerals now have i18n keys and 404 is bilingual (with the language switch). Page titles and meta descriptions also switch with the language (previously only body text switched, leaving Persian titles/numerals behind).

### Changed
- اندروید: versionCode 2101 و versionName 1.11.1. / Android bumped to versionCode 2101 / versionName 1.11.1.

## [1.11.0] - 2026-11-06

### Added
- **وب‌سایت رسمی روی vpn.naxlo.ir (پوشهٔ `website/`):** سایت استاتیک مخصوص cPanel هم‌طراح با اپ (تقریباً مشکی با تأکید فیروزه‌ای، وزیرمتن، راست‌به‌چپ) با کلید زبان فارسی/انگلیسی، favicon و آیکن‌های PWA/OG، کارت‌های دانلود که خودکار از API انتشارهای گیت‌هاب پر می‌شوند، صفحهٔ تست سرعت در مرورگر و فایل اندازه‌گیری `speedtest.bin` (۱۰ مگابایت تصادفی، بدون فشرده‌سازی و بدون کش طبق `.htaccess`). همان محتوا به‌صورت `naxlo-website.zip` برای آپلود در cPanel/Google Drive آماده شده است.
- **Official website on vpn.naxlo.ir (`website/` folder):** a cPanel-ready static site in the app's own design language (near-black, single cyan accent, Vazirmatn, RTL) with a Persian/English switch, favicon + PWA/OG assets, download cards auto-filled from the GitHub releases API, an in-browser speed-test page and the `speedtest.bin` measurement file (10 MB of random bytes, never compressed or cached per `.htaccess`). The same content ships as `naxlo-website.zip` for cPanel / Google Drive upload.
- **تست سرعت در مرورگر:** صفحهٔ `speedtest.html` با گیج زنده همان فایل اندازه‌گیری را استریم می‌کند — اگر اپ متصل باشد، خود تونل سنجیده می‌شود. / **In-browser speed test:** `speedtest.html` streams the same measurement file with a live gauge — with the app connected, you measure the tunnel itself.

### Fixed
- **تست سرعت کار نمی‌کرد:** هدف‌های قبلی در بسیاری از مسیرها مرده یا مسدود بودند (`proof.ovh.net` سال‌هاست خاموش است). اکنون نخستین هدف فایل اندازه‌گیری خود پروژه روی `vpn.naxlo.ir/speedtest.bin` است (با query ضد‌کش)، سپس Cloudflare و آینهٔ tele2؛ هر دو نسخهٔ Electron و Rust. / **The speed test failed:** the old targets are dead or blocked on many routes (`proof.ovh.net` has been down for years). The primary target is now the project's own measurement file at `vpn.naxlo.ir/speedtest.bin` (cache-busted), then Cloudflare and a tele2 mirror; both the Electron and Rust editions.
- **حالت TUN «متصل ولی بدون اینترنت»:** پرس‌وجوهای DNS که فیلترهای WFP به داخل تونل هل می‌دهند قبلاً با قاعدهٔ catch-all به forwarder سرور می‌رفتند — بسیاری از سرورها UDP:53 را بی‌صدا دور می‌اندازند و تونل عملاً مرده بود. اکنون یک outbound از نوع `dns` + قاعدهٔ پورت ۵۳ از اینباند TUN، پاسخ‌ها را داخل خود Xray می‌سازد (DoH رمزنگاری‌شده از داخل پروکسی) و `queryStrategy: UseIPv4` جواب‌های AAAA را از آداپتر فقط-IPv4 دور نگه می‌دارد تا اتصال‌ها روی مسیر دست‌نیافتنی IPv6 هنگ نکنند. / **TUN "connected but no internet":** DNS queries pushed into the tunnel by the WFP filters used to ride the catch-all rule to the server's UDP forwarder — many servers silently drop UDP:53, leaving a dead tunnel. A `dns` outbound plus a port-53 rule from the TUN inbound now answers them inside Xray (encrypted DoH through the proxy), and `queryStrategy: UseIPv4` keeps AAAA answers away from the IPv4-only adapter so connections no longer stall on an unreachable IPv6 route.

### Changed
- **آیکون جدید پر جزئیات (نسخهٔ ۲):** سپر محافظ + حلقه‌های مداری با ماهواره + صورت‌های فلکی + ذره‌های داده روی پرتو N؛ همهٔ Artefactها بازسازی شدند (ico/icns/png، tray، بنر گیت‌هاب، ست تائوری، پیش‌زمینهٔ adaptive اندروید، favicon سایت). / **New detailed icon (v2):** a protective shield + orbit rings with satellites + constellations + data particles on the N beam; every artefact regenerated (ico/icns/png, tray, GitHub banner, Tauri set, Android adaptive foreground, site favicon).
- اندروید: versionCode 2100 و versionName 1.11.0. / Android bumped to versionCode 2100 / versionName 1.11.0.

## [1.10.1] - 2026-11-06

### Fixed
- **نمودار آمار در تغییر ساعت تابستانی (DST) خراب می‌شد:** سطل‌های روزانه با گام ثابت ۲۴ ساعته ساخته می‌شدند؛ در منطقهٔ زمانی اروپا عبور از تغییر ساعت (۲۵ اکتبر) می‌توانست یک تاریخ را در پنجرهٔ ۱۴ روزه **تکرار یا حذف** کند (کلید تکراری React + دقیقه‌های جابه‌جا). اکنون همهٔ محاسبات روزانه تقویمی است (`setDate`) و روزهای ۲۳/۲۵ ساعته درست حساب می‌شوند؛ یک تست جدید پشت‌بند بودن روزها را گارانتی می‌کند.
- **The stats chart broke across DST:** daily buckets were built with fixed 24h steps, so a daylight-saving switch inside the 14-day window could **duplicate or skip a local date** (duplicate React keys + misattributed minutes). All day math is calendar-based now (`setDate`); 23h/25h days are handled correctly and a new test guarantees consecutive buckets.
- **زمان نشست دیگر با crash از بین نمی‌رود:** نشست باز هر ۲۵ ثانیه با پروب سلامت heartbeat می‌گیرد (`endedAt` به‌روز می‌شود)؛ پس از crash، بازیابی startup نشست را با زمان آخرین heartbeat می‌بندد نه با مدت صفر. (پیش‌تر کل مدت نشستِ crash خورده صفر می‌شد.) / **Session time now survives crashes:** the open session heartbeats every 25s with the health probe; startup recovery closes crashed sessions at their last heartbeat instead of zeroing them.
- **پیام‌های ترکی واقعاً به UI می‌رسند:** `tr` در سه نقطه گم می‌شد — `fail()` در IPC الکترون و `normalizeError` در shim تائوری فیلد را هنگام عبور از مرز فرایند **حذف می‌کردند** و `pick()` در رندرر منطق قدیمی fa/en را تکرار کرده بود؛ در نتیجه ترجمه‌های ترکی v1.10.0 هرگز نمایش داده نمی‌شدند. هر سه درست شدند (`pick` اکنون از `pickL` مشترک استفاده می‌کند). / **Turkish messages actually reach the UI now:** `tr` was lost in three places — the Electron IPC `fail()` and the Tauri shim's `normalizeError` **dropped the field** at the process boundary, and the renderer's `pick()` duplicated the old fa/en logic; v1.10.0's Turkish translations never rendered. All three fixed (`pick` now delegates to the shared `pickL`).
- اسپارک‌لاین تاریخچهٔ سرعت در پنجره‌های باریک از کارت بیرون نمی‌زند (`max-width: 100%`). / The speed-history sparkline no longer overflows its card on narrow windows.

### Changed
- اندروید: versionCode 2001 و versionName 1.10.1. / Android bumped to versionCode 2001 / versionName 1.10.1.

## [1.10.0] - 2026-11-06

### Added
- **صفحهٔ آمار مصرف (هر دو نسخهٔ دسکتاپ):** نمودار میله‌ای ۱۴ روزهٔ مدت اتصال (با تقسیم درست نشست‌های شبانه‌روز)، جمع کل زمان اتصال، تعداد نشست‌ها، میانگین هر نشست، سرورهای پراستفاده با پرچم کشور و نمودار تاریخچهٔ تست سرعت. نشست‌ها از لحظهٔ اتصال در خزانهٔ رمزنگاری‌شده ثبت می‌شوند (فقط نام سرور و زمان — هرگز آدرس یا اعتبارنامه)، با بستن برنامه یا crash هم نشست‌های باز بسته می‌شوند و دکمهٔ «پاک‌کردن آمار» همه‌چیز را صفر می‌کند.
- **کاشی Quick Settings اندروید:** اتصال/قطع یک‌ضربی تونل از پنل سریع اندروید بدون باز کردن برنامه؛ وضعیت کاشی زنده است (متصل = فعال با نام سرور)، و در نبود مجوز VPN یا سرور، برنامه را باز می‌کند.
- **ترکی کامل در پیام‌های بومی:** رشته‌های سمت main در الکترون و `l10n.rs` در نسخهٔ Rust حالا `LString.tr` دارند — خطاها، toastها، منوی tray و هشدار خروج در هر دو نسخه سه‌زبانه‌اند (پیش‌تر کاربران ترکی انگلیسی می‌دیدند). یک تست smoke پوشش ترجمهٔ همهٔ رشته‌های ثابت را گارانتی می‌کند.
- **Usage statistics page (both desktop editions):** an animated 14-day connection-time chart (midnight-spanning sessions split correctly), totals/averages, most-used servers with country flags and a speed-test history sparkline. Sessions are recorded in the encrypted vault at connect time (server name + timestamps only — never addresses or credentials), open sessions are closed after crashes/quits, and a clear button resets everything.
- **Android Quick Settings tile:** one-tap tunnel connect/disconnect without opening the app, with a live tile state (active + server name when connected) and a graceful fallback to the app when the VPN permission or a server is missing.
- **Full Turkish for native messages:** main-process strings (Electron) and `l10n.rs` (Rust) now carry `LString.tr` — errors, toasts, the tray menu and the exit warning are trilingual in both editions (Turkish users previously fell back to English). A smoke test guards the translation coverage.

### Changed
- میان‌برهای Ctrl+1..7 برای هفت صفحه (آمار = Ctrl+4). / Page hotkeys are now Ctrl+1..7 (stats = Ctrl+4).
- اندروید: versionCode 2000 و versionName 1.10.0. / Android bumped to versionCode 2000 / versionName 1.10.0.

## [1.9.0] - 2026-11-06

### Fixed
- **باگ‌های حالت TUN کل‌سیستمی (ویندوز):** فایل‌های geo (`geoip.dat`/`geosite.dat`) که اینباوند TUN با مسیریابی geo به آن‌ها نیاز دارد در zip رسمی Xray وجود ندارند و قاعده‌های `geosite:*`/`geoip:*` هنگام شروع هسته fail می‌شدند؛ اکنون naxlo قبل از اجرای هسته آن‌ها را از منابع رسمی v2fly دانلود، در `userData/xray/assets` ذخیره و با `XRAY_LOCATION_ASSET` به هسته معرفی می‌کند (با بازبینی freshness).
- **System-wide TUN bugs (Windows):** the geo assets (`geoip.dat`/`geosite.dat`) required by TUN routing rules are absent from the official Xray zip, so `geosite:*`/`geoip:*` rules hard-failed at core startup; naxlo now downloads them from the official v2fly releases into `userData/xray/assets` and points the core at them via `XRAY_LOCATION_ASSET` (with a staleness re-check).
- نشت DNS دور‌زنندهٔ تونل در ویندوز بسته شد: `autoSystemWfpBlockLeak: ["dns"]` (فقط ویندوز) ترافیک `udp/53`، `tcp/53`، WinDNS و DoT (`853`) بیرون از تونل را با فیلتر WFP مسدود می‌کند. / The Windows DNS leak around the tunnel is closed: `autoSystemWfpBlockLeak: ["dns"]` (Windows-only) blocks `udp/53`, `tcp/53`, the WinDNS client and DoT (`853`) from escaping the tunnel via WFP filters.
- خاموش‌کردن هسته اکنون graceful است: `taskkill /T` بدون `/F` + انتظار تا خروج واقعی فرایند (و در صورت نیاز kill-tree) تا آداپتور Wintun و روت‌های سیستم تمیز پاک شوند. / Core shutdown is graceful now: `taskkill /T` without `/F` plus a real exit wait (kill-tree only as fallback) so the Wintun adapter and system routes clean up properly.
- ارتقای UAC: قفل single-instance قبل از relaunch elevated آزاد می‌شود (نمونهٔ ادمین دیگر به‌عنوان «نمونهٔ دوم» خارج نمی‌شود)؛ در صورت رد کردن UAC برنامه در حال اجرا می‌ماند و حالت اتصال به «پروکسی» برمی‌گردد. / UAC elevation: the single-instance lock is released before the elevated relaunch (the admin instance no longer quits as a "second instance"); on UAC denial the app stays open and rolls the connection mode back to proxy.
- تغییر حالت اتصال (پروکسی ⇄ TUN) هنگام اتصال فعال، اکنون با یک toast اتصال را در حالت جدید برقرار می‌کند؛ failover قبل از اتصال به سرور بعدی اول قطع می‌کند؛ مسیرهای اتصال خودکار TUN بدون ادمین با هشدار رد می‌شوند. / Switching connection mode (proxy ⇄ TUN) while connected now reconnects in the new mode with a toast; failover disconnects before connecting to the next server; TUN auto-connect paths are skipped with a warning when not elevated.
- **باگ‌گیری انیمیشن‌ها:** shimmer اسکلتون/دکمه‌ها فقط `background-position` را انیمیت می‌کند (بدون پرش رنگ)، درخشش نوار پیشرفت کلید `sweep`/`sweep-rtl` جداگانه گرفت، حالت indeterminate و اسلاید بوت در RTL معکوس می‌شوند، میله‌های اکولایزر از پایین مقیاس می‌شوند، `MotionConfig` با «کاهش حرکت» همهٔ انیمیشن‌های motion را خاموش می‌کند و تعویض صفحه اسکرول را به بالا برمی‌گرداند. / **Animation bug-hunt:** skeleton/button shimmer animates `background-position` only (no color jump), the progress sheen got dedicated `sweep`/`sweep-rtl` keyframes, indeterminate progress and the boot slide mirror correctly in RTL, equalizer bars scale from the bottom, `MotionConfig` fully honors reduce-motion, and page switches reset the scroll position.

### Added
- **نسخهٔ Rust از حالت lean خارج شد:** tray سیستم (وضعیت زنده، اتصال/قطع سریع، باز کردن، خروج با همان guard)، شروع خودکار با OS (پلاگین autostart)، **وارد کردن فایل کانفیگ** با پشتیبانی ZIP رمزدار (ZipCrypto/AES) و مودال رمز در UI، انتخاب دستی فایل اجرایی هسته با اعتبارسنجی، **failover خودکار** پس از سه بار شکست پروب سلامت، بستن پنجره به tray وقتی «کوچک‌شدن به tray» فعال است و parity قطع اتصال هنگام حذف/پاک‌کردن سرورها.
- **The Rust edition outgrows its lean scope:** a system tray (live status, quick connect/disconnect, open, guarded quit), OS auto-start (autostart plugin), **config file import** with password-protected ZIP support (ZipCrypto/AES) and the password modal in the UI, manual core-binary picking with validation, **auto-failover** after three failed health probes, close-to-tray when minimize-to-tray is on, and disconnect parity when removing/clearing servers.
- کلیدهای auto-start، کوچک‌شدن به tray، انتخاب فایل هسته و «وارد کردن از فایل» در نسخهٔ Rust از حالت پنهان خارج شدند. / The auto-start, minimize-to-tray, pick-core-file and import-from-file controls are now enabled in the Rust edition.

### Changed
- TUN و به‌روزرسانی خاموش خودکار همچنان مخصوص نسخهٔ الکترون (ویندوز) باقی می‌مانند. / TUN mode and silent self-update remain Electron-only (Windows).
- اندروید: versionCode 1900 و versionName 1.9.0. / Android bumped to versionCode 1900 / versionName 1.9.0.

## [1.8.0] - 2026-11-01

### Added
- **هویت بصری جدید:** نشان «تونل» بازطراحی شد — N هندسی به‌شکل پرتوی نور میان دو گره، حلقه‌های هم‌مرکز و کاشی تقریباً مشکی با عمق. همهٔ artefactها از یک master SVG ساخته می‌شوند: `scripts/make-icons.mjs` (آیکون نصب/taskbar، tray، favicon جدید، بنر گیت‌هاب و آییکون adaptive اندروید).
- **New brand identity:** the mark was redrawn — a geometric N as a light beam between two nodes on concentric orbit rings, on a near-black tile with real depth. Every artefact now renders from one SVG master via `scripts/make-icons.mjs`: installer/taskbar icon, tray icon, a new favicon, the GitHub banner and the Android adaptive icon.
- صفحهٔ بوت برندشده (نشان + wordmark + نوار پیشرفت)، عنوان پنجره بر اساس صفحهٔ فعال، و نشان تعداد نتایج هنگام فیلتر/جست‌وجوی سرورها. / Branded boot screen (mark + wordmark + progress shimmer), per-page window titles and a result-count badge while filtering servers.

### Fixed
- **به‌روزرسانی خودکار اشتراک هرگز اجرا نمی‌شد:** تایمر، فیلد legacy تک‌اشتراکی (قبل از ۱.۲.۰) را بررسی می‌کرد که در خزانه‌های جدید همیشه null است. / **Subscription auto-refresh never ran:** the timer checked the legacy single-URL field (pre-1.2.0) which is always null in modern vaults.
- **فیلتر چیپ‌های کشور در صفحهٔ سرورها اعمال نمی‌شد** (وابستگی جامانده در useMemo). / **The country-chip filter never applied** (missing memo dependency).
- **قطع اتصال هنگام اتصال در جریان** می‌توانست تونل zombie به‌جا بگذارد یا پروکسی سیستم را خراب کند؛ اکنون هر connect با شناسهٔ نسل لغو می‌شود و در همهٔ نقاط انتظار، پروکسی سیستم هم rollback می‌شود. / **Disconnecting mid-connect** could leave a zombie tunnel or a leftover system proxy; every connect now carries a generation token and rolls the system proxy back at every await point.
- حذف/پاک‌کردن سرورها هنگام اتصال، اول اتصال را قطع می‌کند و انتخاب به اولین سرور پشتیبانی‌شدهٔ بعدی منتقل می‌شود. / Removing or clearing servers while connected disconnects first and moves the selection to the next supported server.
- `window.open` در رندرر حالا از همان allowlist لینک‌های خارجی عبور می‌کند؛ بازگردانی پروکسی سیستم، AutoConfigURL (PAC) کاربر را هم برمی‌گرداند؛ حلقهٔ تلاش مجدد updater به ۳ بار محدود شد؛ در macOS پنجرهٔ بازسازی‌شده دوباره guard بستن و tray می‌گیرد. / Renderer `window.open` now passes through the same external-link allowlist; system-proxy restore also returns the user's AutoConfigURL (PAC); updater error retries are capped at 3; a recreated window on macOS re-attaches the close guard and tray.
- میان‌برهای Ctrl+1..6 دیگر هنگام تایپ در فیلدها شلیک نمی‌شوند. / Ctrl+1..6 shortcuts no longer fire while typing in inputs.

### Changed
- اندروید: versionCode 1800 و versionName 1.8.0؛ پیش‌زمینهٔ آییکون adaptive با نشان جدید هم‌خانواده شد. / Android bumped to versionCode 1800 / versionName 1.8.0 with the adaptive icon foreground redrawn to the new mark.

## [1.7.0] - 2026-11-01

### Added
- **نسخهٔ Rust/Tauri (ویندوز، لینوکس، مک):** همان رابط React روی بک‌اند Rust (Tauri v2، WebView بومی) — اشتراک‌های URL با نام و سهمیه از هدرهای پنل، فهرست سرورها با ماسک کامل، اتصال/قطع پروکسی محلی با هستهٔ رسمی Xray (پین v26.10.31 + اعتبارسنجی digest + دانلود خودکار)، تست تأخیر تکی/گروهی، تست سرعت، انتخاب خودکار بهترین سرور، پروکسی سیستم روی هر سه سیستم‌عامل، خزانهٔ AES-256-GCM، هشدار خروج هنگام اتصال و خطاهای دوزبانه.
- **خروجی‌های چندپلتفرمی:** `Naxlo-Rust-Setup-x.x.x.exe` (ویندوز NSIS)، `Naxlo-Rust-vx.x.x-linux-amd64.AppImage` و `.deb` (لینوکس) و `Naxlo-Rust-vx.x.x-macos-arm64.dmg` (مک، بدون امضا با راهنمای Gatekeeper) — همه با checksum در هر ریلیز.
- **Rust/Tauri edition (Windows, Linux, macOS):** the same React UI on a Rust backend — URL subscriptions with panel name/quota headers, fully masked server list, local-proxy connect/disconnect with the official Xray core (pinned v26.10.31, digest-verified, auto-download), single/batch latency tests, speed test, auto server pick, system-proxy integration on all three OSes, AES-256-GCM vault, the connected-exit warning and bilingual errors. Lean scope for now: TUN mode, tray, auto-start, self-update and file import stay Electron-only.
- CI: workflow جدید `tauri.yml` — کامپایل و تست Rust روی هر push/PR و ساخت AppImage/DEB/EXE/DMG روی هر تگ. / New `tauri.yml` workflow — Rust compile/test checks on every push/PR and AppImage/DEB/EXE/DMG bundles on every tag.

### Changed
- نوار عنوان با `data-tauri-drag-region` در هر دو نسخه کشیده می‌شود؛ کلیدهای TUN/tray/شروع خودکار/به‌روزرسانی/وارد کردن فایل در نسخهٔ Rust پنهان‌اند. / The titlebar drags in both editions; TUN/tray/auto-start/update/file-import controls are hidden in the Rust edition.
- اندروید: versionCode 1700 و versionName 1.7.0 تا نام APKها با تگ یکی بماند. / Android bumped to versionCode 1700 / versionName 1.7.0 so tag-derived APK names match.

## [1.6.0] - 2026-10-31

### Added
- **حالت TUN کل‌سیستمی (اختیاری، ویندوز):** در «تنظیمات → پروکسی محلی» می‌توان حالت اتصال را بین «پروکسی» (پیش‌فرض، بدون درایور) و «TUN» جابه‌جا کرد. حالت TUN از **اینباند TUN داخلی خود Xray** استفاده می‌کند (بدون فرایند جانبی) و کل ترافیک سیستم — حتی برنامه‌هایی که پروکسی ویندوز را نادیده می‌گیرند (UWP و…) — از تونل عبور می‌کند. درایور رسمی **Wintun 0.14.1** خودکار دانلود و با **SHA-256 پین‌شده** اعتبارسنجی می‌شود؛ فقط یک‌بار تأیید UAC لازم است و برنامه پس از باز شدن مجدد، خودکار متصل می‌شود. هنگام قطع، آداپتور و روت‌های سیستم پاک می‌شوند.
- **هشدار خروج هنگام اتصال (دسکتاپ + اندروید):** بستن برنامه در حالت اتصال دیگر خاموش نیست؛ هشدار سه‌گزینه‌ای: «خاموش کن و ببند» (قطع اتصال سپس خروج)، «متصل بمان و ببند» (دسکتاپ: رفتن به tray؛ اندروید: ماندن تونل و بسته شدن رابط) و «لغو».
- **System-wide TUN mode (optional, Windows):** a Proxy/TUN connection-mode switch in Settings. TUN uses Xray's built-in TUN inbound (no sidecar), routes the entire system through the tunnel, fetches the official Wintun 0.14.1 driver with pinned SHA-256 verification, and needs a one-time UAC elevation with auto-connect afterwards.
- **Exit warning while connected (desktop + Android):** "Disconnect and close", "Stay connected and close" or "Cancel".

### Changed
- هستهٔ پین‌شدهٔ Xray از v26.3.27 به **v26.10.31** ارتقا یافت (شامل رفع امنیتی MPTCP). / The pinned Xray core moved from v26.3.27 to **v26.10.31** (includes the MPTCP security fix).

## [1.5.0] - 2026-10-15

### Added
- **Password-protected file imports (desktop + Android):** subscription files can now be imported from disk — `txt/json/conf/sub` (raw or Base64) and ZIP archives. Encrypted ZIPs prompt for a password: on Windows the classic ZipCrypto algorithm is implemented directly in `fileImport.ts` (no new native deps, fully unit-tested round-trip); on Android `zip4j` handles both ZipCrypto and AES archives.
- Imported files become first-class subscriptions: they appear in the subscription list with a file badge, keep their name, and can be **refreshed** — the stored password (encrypted vault / EncryptedSharedPreferences) means the prompt appears only once.
- Desktop: file-password modal on the Subscription page with wrong-password feedback; file paths and passwords are registered with the log redactor.
- Android: "Add from file" button (SAF document picker, persisted read permission) + password dialog; new trilingual strings.

### Changed
- Desktop refresh of a file subscription re-reads the file from disk instead of fetching a URL; `reveal` on a file subscription shows its path.

## [1.4.1] - 2026-10-15

### Fixed
- Android: launch crash on devices — `MainActivity` (AppCompatActivity) now uses an AppCompat theme (`Theme.AppCompat.NoActionBar`); app start-up is additionally hardened (Keystore/locale failures can no longer kill the process).
- Desktop: self-update never opens the browser anymore — the web-installer fallback is disabled, the manual "check for update" button now starts the silent download → verify → install pipeline, and the installer runs silently so the app restarts exactly once.
- Desktop: a failed update check/download retries automatically after 45 s.

## [1.4.0] — 2026-10-15

### Added

- **Naxlo for Android** — a native Kotlin client in `android/`:
  - VpnService-based tunnel (no root, no system driver) powered by the
    gomobile-bound Xray core (`libv2ray.aar`), same VLESS/REALITY/WebSocket/
    gRPC support as the desktop config builder.
  - Subscription import with Base64 TXT decoding, `subscription-userinfo`
    quota bars and `profile-title` names, per-country-free server list with
    pins and latency tests.
  - Trilingual UI (fa/en/tr) with the desktop's near-black design language.
  - Encrypted vault (Android Keystore) for links and credentials; nothing
    sensitive reaches logs.
  - CI builds the APK on GitHub Actions and attaches debug/unsigned release
    APKs to every tagged release next to the Windows installers.

## [1.3.0] — 2026-10-15

### Added

- **Turkish interface** — the third language (fa → en → tr). The titlebar
  button cycles through all three; Settings shows a three-way choice. Numbers,
  dates and relative times follow the Turkish locale.
- **Auto — best server** — a dashed "Auto" entry at the top of the server list
  lets Naxlo pick the fastest healthy server at connect time.
- **Auto-switch on failure** — when the active server fails three latency
  probes in a row, Naxlo moves to the next best server and says so in a toast
  (toggle in Settings → Behaviour).
- **Pinned servers** — pin any server to keep it at the top of its group, plus
  a "Pinned" filter chip.
- **Country filter chips** — flag chips with per-country counts above the
  server list filter by country.
- **Panic disconnect** — one button (Home) or the global hotkey `Ctrl+Alt+Q`:
  instant disconnect, system proxy force-restored, warning toast.
- **Localized tray** — tray menu and tooltip follow the app language instead
  of being Persian-only.

### Fixed

- **Locale leakage** — durations, relative times and latency values no longer
  fall back to Persian digits/text when English (or Turkish) is active; the
  whole formatting layer is now driven by a per-language locale table.

### Tests

- `pickBestServer` ordering rules covered (19 tests).

## [1.2.0] — 2026-10-15

### Added

- **Multiple subscriptions** — store several subscription links side by side;
  each keeps its own server list, quota and title. The Servers page groups
  configs under their subscription (sticky group headers with counts, quota
  and a per-subscription refresh button); removing one subscription leaves the
  others untouched. Vaults from older versions migrate automatically.
- **Subscription quota panel (Happ-style)** — the standard
  `subscription-userinfo` response header (`upload/download/total/expire`) is
  parsed and shown as a usage bar with used / remaining / total traffic and an
  expiry countdown (days left, expired state), both on the Subscription page
  and on Home for the active subscription.
- **Subscription names from the service** — the `profile-title` response
  header (plain, url-encoded or `base64:`) becomes the subscription's name.
- **Speed test** — a real download-throughput measurement (Mbps) through the
  active local proxy, on the Home quota card.

### Changed

- Servers page header counts now aggregate all subscriptions plus manual
  imports; the sidebar badge does the same.

### Tests

- `subscription-userinfo` and `profile-title` parsers covered (18 tests).

## [1.1.1] — 2026-10-15

### Fixed

- **Stylesheet bundle restored.** v1.1.0 shipped `global.css` with a missing
  semicolon after the flags `@import`; CSS parsed the two import lines as one
  broken at-rule and dropped the whole component/layout layer from the bundle,
  so the app rendered unstyled. The import is terminated again and the built
  CSS is verified to contain the layout rules.
- **Country flags now render.** `flags.css` targeted `.flag-xx` classes while
  the `Flag` component emits `data-flag="xx"`; selectors regenerated to match.

### Added

- Regression tests: every `@import` in `global.css` must be semicolon-terminated
  (with `components.css` present), and the flag stylesheet/component selector
  contract is asserted, so this class of breakage fails `npm test` instead of
  shipping.

## [1.1.0] — 2026-10-15

### Added

- **Bilingual interface** — full Persian/English UI with a language switcher in
  the titlebar and Settings; layout flips RTL/LTR and all numbers, dates and
  relative times follow the active locale. Main-process messages (toasts and
  errors) travel as bilingual payloads.
- **Country flags** — flag chips rendered from ISO codes (identity lookup) and
  parsed out of subscription remarks (🇩🇪-style emoji are detected, displayed as
  crisp SVG flags and stripped from the text). 257 countries bundled.
- **Automatic updates** — on launch Naxlo checks the GitHub releases feed,
  downloads the new installer silently (sha512-verified via `latest.yml`),
  then closes once and relaunches on the new version. A Settings toggle
  controls it and an "Install now" action appears when an update is staged.
- **Latency sparkline** — the connected session re-probes every 25 seconds and
  draws an animated history on the Home page.
- GitHub releases now publish `latest.yml` alongside the installers so the
  updater feed exists for every tag.

### Changed

- Window controls (minimize / maximize / close) are pinned to the **right**
  edge of the titlebar in both languages, matching the Windows convention.
- Design polish: noise overlay, refined stat tiles with icon chips, cleaner
  server rows, segmented controls, toast and sidebar refinements.

### Fixed

- Segmented-control indicator now tracks items correctly in RTL and LTR.

## [1.0.0] — 2026-10-15

### Added

- **Subscription pipeline** — save a subscription URL, fetch the TXT payload,
  decode Base64 and parse `vless://` (primary), plus `trojan://` and `vmess://`;
  unknown schemes are surfaced with a reason instead of being dropped.
- **Server list** — RTL list with search, filters (VLESS / REALITY / WebSocket /
  gRPC / fastest), per-server and bulk latency tests, speed sorting, select,
  connect, copy-link (with warning) and remove.
- **Local proxy mode** — Xray core runs as a child process with SOCKS5 and HTTP
  loopback inbounds only. No TUN, no Wintun, no drivers, no admin rights.
- **Windows system proxy** — optional automatic WinINET proxy with backup and
  restore of the previous settings, including crash-time reconciliation at
  startup.
- **Core management** — automatic download of the pinned official Xray-core
  release with SHA-512 verification and extraction; custom executable support;
  update check against the upstream releases.
- **Connection lifecycle** — connect / disconnect / refresh subscription
  actions, animated status, real traffic verification through the proxy, public
  identity lookup, latency, uptime, and error surfacing.
- **Routing modes** — all-proxy, Iran-direct (geosite/geoip) and LAN-direct,
  plus optional ad blocking.
- **Privacy** — encrypted vault (Windows DPAPI via `safeStorage`, AES-256-GCM
  fallback), masked UI values with explicit reveal, redacted logging, `0600`
  config files deleted after use, access logs disabled.
- **UI** — Persian RTL interface with the Vazirmatn variable font, near-black
  theme with a single restrained accent (5 accent choices), animated power
  control, aurora background, frameless window, tray integration and toasts.
- **Packaging** — NSIS installer and portable executable for Windows x64,
  built on GitHub Actions per tag with SHA-256 checksums.
- **Tests** — parser, Xray config builder and log redactor smoke tests runnable
  without Electron (`npm test`).

### Security

- Subscription URLs, credentials and REALITY keys are never written to logs,
  the console or renderer state in clear text.
- External links are restricted to an allow-list; renderer navigation and
  window opening are blocked; strict CSP in place.
