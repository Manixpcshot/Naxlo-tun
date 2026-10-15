/**
 * Persian formatting helpers used across the UI.
 */

const numberFormat = new Intl.NumberFormat('fa-IR')
const decimalFormat = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })

export function fa(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return numberFormat.format(value)
}

export function faDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return decimalFormat.format(value)
}

export function faMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${fa(Math.round(value))} ms`
}

export function faClock(timestamp: number): string {
  return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
    new Date(timestamp)
  )
}

export function faDate(timestamp: number): string {
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}

export function faRelative(timestamp: number | null | undefined): string {
  if (!timestamp) return 'هرگز'
  const diff = Date.now() - timestamp
  const abs = Math.abs(diff)
  const suffix = diff >= 0 ? 'پیش' : 'بعد'
  if (abs < 45_000) return diff >= 0 ? 'هم‌اکنون' : 'چند لحظه دیگر'
  const minutes = Math.round(abs / 60_000)
  if (minutes < 60) return `${fa(minutes)} دقیقه ${suffix}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${fa(hours)} ساعت ${suffix}`
  const days = Math.round(hours / 24)
  if (days < 30) return `${fa(days)} روز ${suffix}`
  return faDate(timestamp)
}

export function faDuration(ms: number | null): string {
  if (!ms || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${fa(hours)} ساعت و ${fa(minutes)} دقیقه`
  if (minutes > 0) return `${fa(minutes)} دقیقه و ${fa(seconds)} ثانیه`
  return `${fa(seconds)} ثانیه`
}

export function shortDuration(ms: number | null): string {
  if (!ms || ms < 0) return '۰۰:۰۰'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${fa(Number(h))}:${fa(Number(m))}:${fa(Number(s))}`
}

export function latencyClass(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return ''
  if (ms < 220) return 'latency--good'
  if (ms < 600) return 'latency--mid'
  return 'latency--bad'
}

export function truncate(value: string, max = 42): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

/** Normalise search text for Persian (ی/ک and zero-width non-joiner). */
export function normaliseForSearch(value: string): string {
  return value
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\u0640/g, '')
    .toLowerCase()
    .trim()
}

/* Re-exported so renderer code has one import surface for masking. */
export { maskIp as maskIpLocal, maskAddress, maskMiddle, maskUrl } from '@shared/bridge'
