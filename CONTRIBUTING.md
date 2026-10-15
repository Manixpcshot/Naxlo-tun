# Contributing / مشارکت

Thanks for considering a contribution to Naxlo! 🙏

## Ground rules

1. **Never log secrets.** Any new code path that touches the subscription URL,
   credentials, REALITY keys, server addresses or the generated config must pass
   strings through `redact()` (see `src/main/lib/redact.ts`) before they reach
   the logger, and must not `console.*` them.
2. **Mask in the UI.** The renderer only receives `ServerView` objects; raw
   secrets require an explicit user reveal (`servers.reveal`).
3. **No TUN, no admin.** Keep the app in local-proxy mode; do not introduce
   drivers, services or elevation requirements.
4. Keep the UI Persian-first and RTL; every user-facing string lives in the
   renderer (labels live in `src/renderer/src/lib/labels.ts`).

## Development workflow

```bash
npm install
npm run dev          # hot-reload Electron + React
npm test             # parser / config builder / redactor tests
npm run typecheck    # main + preload + renderer
npm run xray:fetch   # put a core in resources/ for local dev
npm run dist:win     # build installers (Windows host)
```

## Pull requests

- Branch from `main`, keep commits focused, and write the commit message in
  English (the changelog is generated from releases).
- Add or update tests for parser/config/redaction behaviour.
- CI must pass: typecheck, tests and a production build.

## Releases

Every tag `v*` triggers `.github/workflows/release.yml`, which builds the
Windows NSIS + portable installers on a Windows runner, bundles a
checksum-verified Xray core, and publishes a GitHub release with assets and
`SHA256SUMS.txt`. Maintainers cut a tag after merging; **each published change
ships as its own release** so users always have an auditable point in history.
