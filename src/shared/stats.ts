/**
 * Pure stats aggregation shared by the renderer (stats page), the main
 * process and the smoke tests — no DOM, no Electron imports.
 */
import type { SessionStat, SpeedSample } from './types'

export interface DayBucket {
  /** Local-date key `YYYY-MM-DD`. */
  date: string
  minutes: number
  sessions: number
}

export interface ServerUsage {
  serverId: string
  serverName: string
  country: string | null
  minutes: number
  sessions: number
}

export interface StatsSummary {
  daily: DayBucket[]
  totalMinutes: number
  totalSessions: number
  avgMinutes: number
  topServers: ServerUsage[]
}

/** Local-timezone date key so daily buckets follow the user's calendar. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Aggregate closed sessions into `days` local-day buckets ending today.
 * Sessions that span midnight contribute to every day they overlap.
 * Open sessions (`endedAt <= startedAt`) are ignored — the vault closes
 * stale ones at startup.
 */
export function aggregateStats(sessions: SessionStat[], days = 14, now = Date.now()): StatsSummary {
  // Build the bucket list first so empty days still render.
  const daily: DayBucket[] = []
  const index = new Map<string, DayBucket>()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(today.getTime() - i * DAY_MS)
    const bucket: DayBucket = { date: key, minutes: 0, sessions: 0 }
    daily.push(bucket)
    index.set(key, bucket)
  }

  const perServer = new Map<string, ServerUsage>()
  let totalMinutes = 0
  let totalSessions = 0

  for (const s of sessions) {
    if (!(s.endedAt > s.startedAt)) continue
    const minutes = (s.endedAt - s.startedAt) / 60000
    totalMinutes += minutes
    totalSessions += 1

    const usage = perServer.get(s.serverId) ?? {
      serverId: s.serverId,
      serverName: s.serverName,
      country: s.country,
      minutes: 0,
      sessions: 0
    }
    usage.minutes += minutes
    usage.sessions += 1
    // Keep the freshest display name/country for the server id.
    usage.serverName = s.serverName || usage.serverName
    usage.country = s.country ?? usage.country
    perServer.set(s.serverId, usage)

    // Split the session across every bucket-day it overlaps.
    let cursor = new Date(s.startedAt)
    cursor.setHours(0, 0, 0, 0)
    while (cursor.getTime() <= s.endedAt) {
      const bucket = index.get(dayKey(cursor.getTime()))
      if (bucket) {
        const dayStart = cursor.getTime()
        const dayEnd = dayStart + DAY_MS
        const overlap = Math.min(s.endedAt, dayEnd) - Math.max(s.startedAt, dayStart)
        if (overlap > 0) bucket.minutes += overlap / 60000
        if (s.startedAt >= dayStart && s.startedAt < dayEnd) bucket.sessions += 1
      }
      cursor = new Date(cursor.getTime() + DAY_MS)
    }
  }

  for (const bucket of daily) bucket.minutes = Math.round(bucket.minutes * 10) / 10
  const topServers = [...perServer.values()]
    .map((u) => ({ ...u, minutes: Math.round(u.minutes) }))
    .sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions)
    .slice(0, 6)

  return {
    daily,
    totalMinutes: Math.round(totalMinutes),
    totalSessions,
    avgMinutes: totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0,
    topServers
  }
}

/** Minutes → compact human string ("2h 15m" / "45m"). Locale-agnostic. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest}m`
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`
}

/** Keep only the newest `cap` samples, sorted ascending by time. */
export function trimSpeedSamples(samples: SpeedSample[], cap = 120): SpeedSample[] {
  return [...samples].sort((a, b) => a.at - b.at).slice(-cap)
}
