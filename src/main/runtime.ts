/**
 * Tiny runtime flags shared across the main process.
 */
export const runtime = {
  /** True once the user really wants to quit (as opposed to hiding to tray). */
  quitting: false,
  /** True when the app was launched by Windows at login. */
  autoStarted: false,
  /** True when relaunched elevated (UAC) for TUN mode. */
  tunElevated: false,
  /** Set when a second instance was launched and the window was focused. */
  secondInstanceAt: 0
}
