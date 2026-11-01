/**
 * Runtime flavour detection.
 *
 * The Tauri build installs `window.__NAXLO_TAURI__` from its shim before the
 * React app boots; the Electron build never sets it. Features that only exist
 * in one backend (TUN mode, tray, auto-start, self-update, file import) are
 * gated with `isTauri()` so both editions share one UI codebase.
 */
declare global {
  interface Window {
    __NAXLO_TAURI__?: boolean
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && window.__NAXLO_TAURI__ === true
}
