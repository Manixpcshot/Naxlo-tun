/**
 * Speed-test measurement model (shared by the Electron main process and the
 * smoke tests; the Rust edition and the website mirror the same constants).
 *
 * speedtest.net-style adaptive measurement instead of "download one fixed
 * file": a short single-stream probe estimates the line, the main phase then
 * pulls a size from a ladder that keeps the transfer running long enough
 * (~8 s), with several parallel streams so fast lines are not limited by a
 * single TCP connection, and the slow-start ramp is excluded from the final
 * rate (steady-state window only).
 */

/** Probe phase: one stream, small cap, short deadline. */
export const SPEED_PROBE_BYTES = 2 * 1024 * 1024
export const SPEED_PROBE_MS = 4_000

/** Main phase: parallel streams until the deadline or the per-stream cap. */
export const SPEED_MAIN_MS = 8_000
export const SPEED_STREAMS = 4

/** Slow-start window excluded from the steady-state rate. */
export const SPEED_RAMP_MS = 1_500

/** Size ladder in MiB — picked so the main phase fills ~8 seconds. */
export const SPEED_LADDER_MB = [8, 16, 32, 64, 100] as const
export const SPEED_MAX_MB = 100

/** Whole-test budget so the UI never waits forever (probe + main + slack). */
export const SPEED_BUDGET_MS = SPEED_PROBE_MS + SPEED_MAIN_MS + 2_000

/**
 * Choose the transfer size for the main phase from the probe rate:
 * `probeMbps * seconds / 8` is the MiB count that would fill the window.
 */
export function pickSizeMb(probeMbps: number, seconds = SPEED_MAIN_MS / 1000): number {
  if (!Number.isFinite(probeMbps) || probeMbps <= 0) return SPEED_LADDER_MB[0]
  const ideal = (probeMbps * seconds) / 8
  for (const step of SPEED_LADDER_MB) if (step >= ideal) return step
  return SPEED_MAX_MB
}

/**
 * Steady-state rate: bytes and time after the slow-start ramp only, so a
 * 1 Gbit/s line measured over 8 s is not dragged down by its first 1.5 s.
 */
export function steadyMbps(totalBytes: number, rampBytes: number, totalMs: number, rampMs = SPEED_RAMP_MS): number {
  const ms = Math.max(200, totalMs - rampMs)
  const bytes = Math.max(0, totalBytes - rampBytes)
  return Math.round(((bytes * 8) / ms / 1000) * 10) / 10
}

/** Fixed tele2 mirror sizes (MiB) used when the line picks a big ladder step. */
export const TELE2_SIZES_MB = [10, 20, 50, 100] as const

/** Largest tele2 mirror file that fits into the chosen ladder size. */
export function tele2SizeMb(sizeMb: number): number {
  let pick: number = TELE2_SIZES_MB[0]
  for (const size of TELE2_SIZES_MB) if (size <= sizeMb) pick = size
  return pick
}
