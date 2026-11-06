# Naxlo website — vpn.naxlo.ir

Static, cPanel-ready website for the Naxlo project: landing page (Persian +
English), in-browser speed test, and the measurement file the desktop and
Rust apps download when you press «تست سرعت».

## Contents

| File | Purpose |
|---|---|
| `index.html` | Landing page (RTL Persian, EN toggle, dark app-like design) |
| `speedtest.html` | In-browser speed test (gauge + live progress) |
| `speedtest.bin` | 10 MB measurement file used by the apps and the web test — **must stay uncompressed & un-cached** (see `.htaccess`) |
| `styles.css`, `app.js` | Design tokens identical to the app + behaviour (i18n, releases list, gauge) |
| `favicon.svg/.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `og.png` | Brand assets |
| `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `404.html` | PWA/SEO niceties |
| `.htaccess` | cPanel/Apache config: compression, caching, security headers, HTTPS force, `no-store` for `speedtest.bin` |

## Deploy on cPanel

1. In cPanel create the subdomain **vpn.naxlo.ir** (or use `public_html`).
2. Open **File Manager**, go to the subdomain's document root.
3. Upload `naxlo-website.zip` (same contents as this folder) and **Extract** it there — or upload the files one by one.
4. Make sure `.htaccess` was uploaded (it is a hidden file: enable *Show hidden files* in File Manager settings).
5. Run **SSL/TLS Status → AutoSSL** for the subdomain; the `.htaccess` then forces HTTPS automatically.
6. Done — `https://vpn.naxlo.ir/` serves the site and `https://vpn.naxlo.ir/speedtest.bin` is the app's measurement endpoint.

No PHP, no database, no build step: pure static files.

## Notes

- Regenerate `speedtest.bin` only if you suspect its content leaked into a
  cache somewhere: `head -c 10485760 /dev/urandom > speedtest.bin`
  (random bytes so no proxy can compress it).
- The download cards read the GitHub releases API from the browser, so they
  always point at the newest release assets — no site edit needed per version.
