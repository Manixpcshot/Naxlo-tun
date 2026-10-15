/** Stable, non-sensitive identifiers derived from secrets (never log inputs). */
import { createHash } from 'node:crypto'

/** sha256(input) truncated — safe to store/log because it cannot be reversed. */
export function stableId(input: string, length = 12): string {
  return createHash('sha256').update(input).digest('hex').slice(0, length)
}
