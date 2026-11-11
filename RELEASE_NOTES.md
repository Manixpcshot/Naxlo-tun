# Naxlo 1.15.2 — باگ‌گیری کامل / full bug-hunt release

یک دور کامل باگ‌گیری روی همهٔ کلاینت‌ها (Electron، Rust/Tauri، اندروید) و وب‌سایت:
۱۱ باگ واقعی پیدا و درست شد، با ۱۰ تست جدید که هرکدام را قفل می‌کند.

A full bug-hunt across every client (Electron, Rust/Tauri, Android) and the website:
11 real defects found and fixed, each locked down by a new test.

---

## فارسی

### ۱. رمز trojan با `@` — در سه کلاینت آدرس سرور خراب می‌شد
برش اعتبارنامه در **وب‌سایت**، **اعتبارسنج داخل اپ** و **پارسر اندروید** روی نخستین `@`
انجام می‌شد، پس `trojan://p@ss@host:443` به آدرس `ss@host` و خطای «پورت معتبر نیست»
تبدیل می‌شد — درحالی‌که پارسر دسکتاپ درست کار می‌کرد و وصل می‌شد. حالا هر چهار مورد
اعتبارنامه را در **واپسین `@` پیش از query** قطع می‌کنند و یک `@` رمزنگاری‌نشده داخل
query (`?path=/@ws`) دیگر جداکننده حساب نمی‌شود (پیش‌تر همان لینک حتی در دسکتاپ یک
سرور با آدرس `@ws` می‌ساخت).

### ۲. صفحهٔ آمار زنده شد
کارت «امروز» که طبق توضیح خودش جلسهٔ باز را هم می‌شمارد، در طول اتصال زنده تکان
نمی‌خورد و نمودار ۱۴ روزه جلسهٔ در حال اجرا را کامل نادیده می‌گرفت. حالا جلسهٔ باز در
هر دو تا «همین لحظه» شمرده می‌شود، صفحه هر ۱۰ ثانیه هنگام اتصال بی‌صدا vault را
دوباره می‌خواند و سطل‌های روزانه نیمه‌شب بدون رفرش جابه‌جا می‌شوند.

### ۳. تغییر پورت محلی در حالت متصل = بازسازی تونل
عوض‌کردن پورت SOCKS/HTTP هنگام اتصال فقط عدد داخل UI را عوض می‌کرد؛ هسته روی پورت‌های
قبلی می‌ماند و هیچ‌کس روی پورت جدید پاسخ نمی‌داد. حالا در Electron و Rust/Tauri تونل
بازسازی می‌شود — با debounce ۹۰۰ms تا تایپ رقم‌به‌رقم باعث قطع‌وصل پیاپی نشود.

### ۴. کلید «پروکسی سیستم» بلافاصله اثر می‌کند
این تنظیم فقط هنگام ساخت تونل خوانده می‌شد: روشن‌کردنش تا اتصال بعدی بی‌اثر بود و
خاموش‌کردنش پروکسی ویندوز را تا قطع‌شدن روی ناکسو نگه می‌داشت. حالا در همان لحظه
اعمال/آزاد می‌شود (در هر دو نسخه).

### ۵. پیام فارسی در حالت انگلیسی: «این کانفیگ پشتیبانی نمی‌شود»
`unsupportedReason` یک رشتهٔ فارسی خام بود و `validateConfig` همان متن را به‌عنوان
**هر دو** زبان می‌داد (`L(reason, reason)`)؛ پس اتصال به یک کانفیگ پشتیبانی‌نشده
(مثلاً `ss://`) در حالت انگلیسی با پیام فارسی شکست می‌خورد و کارت سرور هم همان دلیل
فارسی را در EN/TR نشان می‌داد. حالا `{fa, en, tr}` است و ورودی‌های قدیمی vault هم
درست رندر می‌شوند.

### ۶. سایت: اعتبارسنج vmess v2 و نتیجهٔ چندزبانه
فیلدهای `path` (برای ws)، `serviceName` (برای gRPC) و `sni` در لینک‌های vmess v2
نمایش داده نمی‌شدند و رمز trojan هرگز به‌عنوان چیپ پوشیده نشان داده نمی‌شد؛ ضمن اینکه
نتیجهٔ اعتبارسنجی بعد از تعویض زبان به زبان قبلی می‌ماند («کانفیگ معتبر است» فارسی
روی صفحهٔ انگلیسی). هر دو درست شد.

### ۷. پوستهٔ روز: اسکرول‌بار نامرئی در فایرفاکس
`scrollbar-color` که فایرفاکس می‌خواند سفید مانده بود (فقط شبه‌عنصرهای webkit معکوس
شده بودند) → سفید روی سفید. حالا تیره شد.

### ۸. اندروید: متن تنظیمات با TUN واقعی تناقض داشت
تنظیمات هنوز می‌گفت «بدون TUN سیستمی» و پورت‌های `127.0.0.1:10808/10809` را نشان
می‌داد که کلاینت VPN اصلاً بازشان نمی‌کند. متن‌ها در هر سه زبان بازنویسی شد.

### ۱۰. CI: دارایی‌های انتشار با یک خطای گذرا از دست نمی‌روند
کار آپلود `naxlo-website.zip` چند ثانیه بعد از تگ تمام می‌شود؛ یک قطعیِ
`uploads.github.com` کل انتشار را بدون zip سایت می‌گذاشت. هر دو مرحلهٔ آپلود حالا
تا چند بار با فاصلهٔ ۲۰ ثانیه تلاش مجدد می‌کنند.

### ۹. یک باگ در خود تست‌ها
بررسی پوشش ترکی گروه اشتباه regex را می‌خواند (`match[6]` به‌جای `match[7]`)، پس
آرگومان سوم صریح هرگز تشخیص داده نمی‌شد و برای رشته‌های `"..."` کنترل ترجمه بی‌صدا
رد می‌شد.

### تست‌ها
**۸۲ تست محلی** (۵۲ smoke + ۳۰ DOM وب‌سایت) و **۱۳ تست واحد اندروید** در CI — همه سبز.
`npm run typecheck`، `npm test` و `npm run build` هم سبز.

---

## English

### 1. A trojan password containing `@` broke the address in three clients
The credential split used the **first** `@` in the website validator, the in-app
validator and the Android parser, so `trojan://p@ss@host:443` turned into the address
`ss@host` with an "invalid port" error — while the desktop parser connected fine. All
four now cut at the **last `@` before the query**, and an unencoded `@` inside the query
(`?path=/@ws`) is no longer treated as a separator (that link used to create a server
whose address was `@ws`, even on the desktop).

### 2. The Stats page is live
The "Today" card — which says it includes the open session — never moved during a live
session, and the 14-day chart ignored the running session entirely. The open session now
counts up to `now` in both, the page silently re-reads the vault every 10 s while
connected (60 s idle), and the day buckets roll over at midnight without a reload.

### 3. Changing a local port while connected rebuilds the tunnel
Editing the SOCKS/HTTP port during a session changed only the number in the UI: the core
kept the old ports and nothing answered on the new ones. Electron and Rust/Tauri now
rebuild the tunnel — debounced by 900 ms so typing digit by digit cannot cause a
reconnect per keystroke.

### 4. The system-proxy switch applies immediately
It was only read while building the tunnel, so enabling it did nothing until the next
reconnect and disabling it left Windows pointing at Naxlo until disconnect. It is applied
or released on the spot now, in both editions.

### 5. Persian text in English mode: "this config is not supported"
`unsupportedReason` was a bare Persian string and `validateConfig` passed it as **both**
languages (`L(reason, reason)`), so connecting to an unsupported config (an `ss://` link)
failed with a Persian message in English mode, and the server card showed the same Persian
reason in EN/TR. It is now `{fa, en, tr}`, with legacy vault entries still rendering.

### 6. Website: vmess v2 fields and a multilingual result
`path` (ws), `serviceName` (gRPC) and `sni` were not reported for vmess v2 links and the
trojan password was never shown as a masked chip; on top of that a validation result stayed
in the previous language after a switch (a Persian "config is valid" on an English page).
Both fixed.

### 7. Day theme: invisible scrollbar in Firefox
`scrollbar-color` — the property Firefox reads — was still white (only the webkit
pseudo-elements had been inverted), i.e. white on white. Now darkened.

### 8. Android: settings copy contradicted the real tunnel
The screen still claimed "No system TUN" and advertised `127.0.0.1:10808/10809` ports that
the VPN client never opens. Rewritten in all three languages.

### 10. CI: a transient upload error no longer costs the release assets
The job that attaches `naxlo-website.zip` finishes seconds after the tag push; one dropped
`uploads.github.com` connection used to leave the release without the site zip. Both upload
steps now retry a few times, 20 s apart.

### 9. A bug in the tests themselves
The Turkish-coverage scanner read the wrong regex group (`match[6]` instead of `match[7]`),
so an explicit third argument was never detected and, for double-quoted English strings, the
translation check was silently skipped.

### Tests
**82 local tests** (52 smoke + 30 website DOM) and **13 Android unit tests** in CI — all
green, along with `npm run typecheck`, `npm test` and `npm run build`.
