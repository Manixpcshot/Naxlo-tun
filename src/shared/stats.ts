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

/**
 * Aggregate closed sessions into `days` local-day buckets ending today.
 * Sessions that span midnight contribute to every day they overlap.
 * Open sessions (`reason === ''`) are ignored — a running session is still
 * heartbeating its `endedAt`; crashed ones are closed as `stale` at startup.
 *
 * Day arithmetic is calendar-based (`setDate`), never fixed 24h steps: a DST
 * switch inside the window would otherwise duplicate or skip a local date.
 */
export function aggregateStats(sessions: SessionStat[], days = 14, now = Date.now()): StatsSummary {
  // Build the bucket list first so empty days still render.
  const daily: DayBucket[] = []
  const index = new Map<string, DayBucket>()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)
    const key = dayKey(day.getTime())
    const bucket: DayBucket = { date: key, minutes: 0, sessions: 0 }
    daily.push(bucket)
    index.set(key, bucket)
  }

  const perServer = new Map<string, ServerUsage>()
  let totalMinutes = 0
  let totalSessions = 0

  for (const s of sessions) {
    if (!s.reason || !(s.endedAt > s.startedAt)) continue
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

    // Split the session across every bucket-day it overlaps (calendar days —
    // a DST day is 23h or 25h long, so never step by a fixed 24h).
    const cursor = new Date(s.startedAt)
    cursor.setHours(0, 0, 0, 0)
    while (cursor.getTime() <= s.endedAt) {
      const dayStart = cursor.getTime()
      const next = new Date(cursor)
      next.setDate(cursor.getDate() + 1)
      const dayEnd = next.getTime()
      const bucket = index.get(dayKey(dayStart))
      if (bucket) {
        const overlap = Math.min(s.endedAt, dayEnd) - Math.max(s.startedAt, dayStart)
        if (overlap > 0) bucket.minutes += overlap / 60000
        if (s.startedAt >= dayStart && s.startedAt < dayEnd) bucket.sessions += 1
      }
      cursor.setTime(dayEnd)
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

export interface TodaySummary {
  /** Local-day key (`YYYY-MM-DD`) of the window being summarised. */
  date: string
  /** Minutes inside the tunnel during the current local day. */
  minutes: number
  /** Sessions that overlap the current local day (open ones included). */
  sessions: number
  /** Same measure for the previous local day, used for the delta. */
  yesterdayMinutes: number
  /** Percentage change against yesterday, null when yesterday was unused. */
  deltaPercent: number | null
  bestMbps: number | null
  avgMbps: number | null
  speedSamples: number
}

/**
 * "Today at a glance": how long the tunnel has been up during the current
 * local day, how that compares with yesterday, and today's speed samples.
 * Calendar-based (never fixed 24h steps) so a DST switch cannot shift the
 * window, and open sessions count up to `now`.
 */
export function summarizeToday(sessions: SessionStat[], speed: SpeedSample[], now = Date.now()): TodaySummary {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const startMs = startOfDay.getTime()
  const yesterdayStart = new Date(startMs)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayMs = yesterdayStart.getTime()

  const overlap = (from: number, to: number): { minutes: number; sessions: number } => {
    let minutes = 0
    let count = 0
    for (const session of sessions) {
      const end = session.endedAt === 0 ? now : session.endedAt
      if (end <= from || session.startedAt >= to) continue
      const span = Math.min(end, to) - Math.max(session.startedAt, from)
      if (span > 0) {
        minutes += span / 60000
        count += 1
      }
    }
    return { minutes: Math.round(minutes), sessions: count }
  }

  const today = overlap(startMs, now + 1)
  const yesterday = overlap(yesterdayMs, startMs)
  const todaysSpeed = speed.filter((sample) => sample.at >= startMs && sample.at <= now)
  const best = todaysSpeed.length > 0 ? Math.max(...todaysSpeed.map((sample) => sample.mbps)) : null
  const avg =
    todaysSpeed.length > 0
      ? Math.round((todaysSpeed.reduce((acc, sample) => acc + sample.mbps, 0) / todaysSpeed.length) * 10) / 10
      : null

  return {
    date: dayKey(now),
    minutes: today.minutes,
    sessions: today.sessions,
    yesterdayMinutes: yesterday.minutes,
    deltaPercent: yesterday.minutes > 0 ? Math.round(((today.minutes - yesterday.minutes) / yesterday.minutes) * 100) : null,
    bestMbps: best,
    avgMbps: avg,
    speedSamples: todaysSpeed.length
  }
}

/** Keep only the newest `cap` samples, sorted ascending by time. */
export function trimSpeedSamples(samples: SpeedSample[], cap = 120): SpeedSample[] {
  return [...samples].sort((a, b) => a.at - b.at).slice(-cap)
}
