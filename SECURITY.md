# Security Policy / سیاست امنیتی

## Reporting a vulnerability — گزارش آسیب‌پذیری

Please do **not** open public issues for security problems. Instead, contact the
maintainers privately through a GitHub security advisory on this repository
(*Repository → Security → Advisories → Report a vulnerability*), or open a
private issue if advisories are unavailable. We aim to acknowledge reports
within 7 days and to publish fixes as a new release.

لطفاً مشکلات امنیتی را به‌صورت issue عمومی مطرح **نکنید**. از طریق
*Security Advisories* مخزن به‌صورت خصوصی گزارش دهید؛ ما تلاش می‌کنیم ظرف ۷ روز
پاسخ دهیم و اصلاحیه را در یک ریلیز جدید منتشر کنیم.

## Threat model — مدل تهدید

Naxlo assumes the local machine is trusted but the network is not. The design
goals and their enforcement points:

| Asset | Protection |
| --- | --- |
| Subscription URL | Encrypted vault (`safeStorage` / DPAPI on Windows); masked in UI; never logged |
| Credentials (UUID / password / REALITY keys) | Same vault; masked everywhere; redacted before any log write |
| Generated Xray config | Written to `userData` with `0600`, deleted when the core exits |
| System proxy settings | Backed up before modification, restored on disconnect, crash and uninstall-safe startup reconcile |
| Core binary | Downloaded from the official XTLS/Xray-core release and verified against the published SHA-512 digest |
| Renderer | `contextIsolation`, `sandbox`, no `nodeIntegration`, navigation and window-open blocked, strict CSP |

## What is out of scope

- Attacks requiring administrator access to the same Windows account (DPAPI
  keys are user-bound by design).
- Traffic analysis by the proxy server operator itself.
- Vulnerabilities in the upstream Xray core; we track upstream releases and
  bump the pinned version promptly.

## Supported versions

Only the latest published release is supported. Each release is published with
`SHA256SUMS.txt` so users can verify integrity of the installers.
