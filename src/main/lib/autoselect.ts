/**
 * Smart server selection.
 *
 * Pure and dependency-free so the ordering rules can be unit-tested:
 * supported servers only, excluded ids skipped, then lowest known latency
 * first (untested servers after tested ones, newest configs breaking ties).
 */
import type { ServerConfig } from '../../shared/types'

export function pickBestServer(servers: ServerConfig[], exclude: string[] = []): ServerConfig | null {
  const excluded = new Set(exclude)
  const candidates = servers.filter((server) => server.supported && !excluded.has(server.id))
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => {
    const la = a.latencyMs === null ? Number.POSITIVE_INFINITY : a.latencyMs
    const lb = b.latencyMs === null ? Number.POSITIVE_INFINITY : b.latencyMs
    if (la !== lb) return la - lb
    return b.addedAt - a.addedAt
  })[0]
}
