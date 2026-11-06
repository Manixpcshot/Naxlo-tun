/**
 * Usage statistics recorder.
 *
 * Sessions are written into the encrypted vault (`stats.sessions`, capped).
 * An open session is stored with `endedAt: 0` the moment it starts, so even
 * a hard crash keeps the record; stale open sessions are closed at startup
 * with `endedAt = startedAt` (zero duration, reason `stale`).
 *
 * Privacy: only the server *name* (already shown in the UI) plus timestamps
 * are stored — never addresses or credentials.
 */
import { log } from './logger'
import { getVault, updateVault } from './secretStore'
import { trimSpeedSamples } from '../../shared/stats'
import type { SessionStat, StatsPayload } from '../../shared/types'

const SCOPE = 'stats'
const SESSION_CAP = 400

let active: SessionStat | null = null

/** Close sessions left open by a previous crash/kill. Call after loadVault(). */
export function recoverStats(): void {
  const stats = getVault().stats
  let touched = false
  for (const s of stats.sessions) {
    if (!(s.endedAt > s.startedAt)) {
      s.endedAt = s.startedAt
      s.reason = 'stale'
      touched = true
    }
  }
  if (touched) {
    updateVault({ stats: { ...stats } })
    log.info(SCOPE, 'closed stale sessions from a previous run')
  }
}

export function beginSession(serverId: string, serverName: string, mode: 'proxy' | 'tun'): void {
  const startedAt = Date.now()
  active = {
    serverId,
    serverName,
    country: null,
    mode,
    startedAt,
    endedAt: 0,
    reason: ''
  }
  pushSession({ ...active })
}

export function endSession(reason: string): void {
  const session = active
  active = null
  if (!session) return
  const endedAt = Date.now()
  const stats = getVault().stats
  const stored = stats.sessions.find(
    (s) => s.startedAt === session.startedAt && s.serverId === session.serverId && !(s.endedAt > s.startedAt)
  )
  if (stored) {
    stored.endedAt = endedAt
    stored.reason = reason
  } else {
    pushSession({ ...session, endedAt, reason })
  }
  updateVault({ stats: { ...stats, sessions: capSessions(stats.sessions) } })
}

/** Flush an open session on app exit so its time is not lost. */
export function endSessionIfActive(reason: string): void {
  if (active) endSession(reason)
}

export function recordSpeed(mbps: number, ms: number): void {
  const stats = getVault().stats
  updateVault({
    stats: { ...stats, speed: trimSpeedSamples([...stats.speed, { at: Date.now(), mbps, ms }]) }
  })
}

export function getStats(): StatsPayload {
  return getVault().stats
}

export function clearStats(): StatsPayload {
  const empty: StatsPayload = { sessions: [], speed: [] }
  updateVault({ stats: empty })
  log.info(SCOPE, 'usage statistics cleared')
  return empty
}

function pushSession(session: SessionStat): void {
  const stats = getVault().stats
  updateVault({ stats: { ...stats, sessions: capSessions([...stats.sessions, session]) } })
}

function capSessions(sessions: SessionStat[]): SessionStat[] {
  return sessions.length > SESSION_CAP ? sessions.slice(-SESSION_CAP) : sessions
}
