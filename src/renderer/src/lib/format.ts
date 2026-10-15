/**
 * Locale-aware formatting (Persian default, English optional).
 *
 * The active locale is set once by the i18n provider; every helper below reads
 * it, so components stay free of locale plumbing.
 */
import type { Lang } from '@shared/i18n'
import type { SubUserinfo } from '@shared/bridge'

const LOCALES: Record<Lang, string> = { fa: 'fa-IR', en: 'en-US', tr: 'tr-TR' }

let locale: string = LOCALES.fa
let lang: Lang = 'fa'

export function setFormatLocale(next: Lang): void {
  lang = next
  locale = LOCALES[next] ?? LOCALES.en
}

export function currentLocale(): string {
  return locale
}

const numberFormat: Record<Lang, Intl.NumberFormat> = {
  fa: new Intl.NumberFormat('fa-IR'),
  en: new Intl.NumberFormat('en-US'),
  tr: new Intl.NumberFormat('tr-TR')
}

const relativeFormat: Record<Lang, Intl.RelativeTimeFormat> = {
  fa: new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' }),
  en: new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }),
  tr: new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' })
}

export function fa(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return numberFormat[lang].format(value)
}

export function faDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

export function faMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${numberFormat[lang].format(Math.round(value))} ms`
}

export function faClock(timestamp: number): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
    new Date(timestamp)
  )
}

export function faDate(timestamp: number): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}

export function faRelative(timestamp: number | null | undefined): string {
  if (!timestamp) return lang === 'fa' ? 'هرگز' : lang === 'tr' ? 'asla' : 'never'
  const diffMs = Date.now() - timestamp
  const abs = Math.abs(diffMs)
  const rtf = relativeFormat[lang]
  if (abs < 45_000) return lang === 'fa' ? 'هم‌اکنون' : lang === 'tr' ? 'şimdi' : 'just now'
  if (abs < 3_600_000) return rtf.format(Math.round(-diffMs / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(-diffMs / 3_600_000), 'hour')
  if (abs < 2_592_000_000) return rtf.format(Math.round(-diffMs / 86_400_000), 'day')
  return faDate(timestamp)
}

export function faDuration(ms: number | null): string {
  if (!ms || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const n = numberFormat[lang].format
  if (lang === 'en') {
    if (hours > 0) return `${n(hours)}h ${n(minutes)}m`
    if (minutes > 0) return `${n(minutes)}m ${n(seconds)}s`
    return `${n(seconds)}s`
  }
  if (lang === 'tr') {
    if (hours > 0) return `${n(hours)} sa ${n(minutes)} dk`
    if (minutes > 0) return `${n(minutes)} dk ${n(seconds)} sn`
    return `${n(seconds)} sn`
  }
  if (hours > 0) return `${n(hours)} ساعت و ${n(minutes)} دقیقه`
  if (minutes > 0) return `${n(minutes)} دقیقه و ${n(seconds)} ثانیه`
  return `${n(seconds)} ثانیه`
}

export function shortDuration(ms: number | null): string {
  if (!ms || ms < 0) return lang === 'fa' ? '۰۰:۰۰:۰۰' : '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  const raw = `${h}:${m}:${s}`
  return lang === 'fa' ? raw.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : raw
}

/** Human readable byte size in the active locale (binary units). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${fa(rounded)} ${units[unit]}`
}

/** Bytes consumed from a subscription quota (upload + download). */
export function subUsed(info: SubUserinfo): number {
  return info.upload + info.download
}

/** Bytes left, or null when the panel reports unlimited traffic. */
export function subRemaining(info: SubUserinfo): number | null {
  if (!info.total) return null
  return Math.max(0, info.total - subUsed(info))
}

/** 0–100 usage ratio, or null for unlimited quotas. */
export function subPercent(info: SubUserinfo): number | null {
  if (!info.total) return null
  return Math.min(100, Math.round((subUsed(info) / info.total) * 100))
}

/** Whole days left until the quota expires (negative = expired). */
export function subDaysLeft(info: SubUserinfo): number | null {
  if (!info.expire) return null
  return Math.floor((info.expire * 1000 - Date.now()) / 86_400_000)
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

/** Normalise search text (Persian ی/ک variants, ZWNJ, case). */
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

/* Flag helpers ------------------------------------------------------------- */

const REGIONAL_PAIR = /\p{Regional_Indicator}{2}/gu

/** Extract ISO country codes embedded as emoji flags in a server name. */
export function extractFlagCodes(text: string): string[] {
  const codes: string[] = []
  for (const match of text.matchAll(REGIONAL_PAIR)) {
    const pair = match[0]
    const code = String.fromCharCode(pair.codePointAt(0)! - 0x1f1e6 + 65, pair.codePointAt(2)! - 0x1f1e6 + 65)
    codes.push(code.toLowerCase())
  }
  return codes
}

/** Strip flag emoji (and stray regional indicators) from a display name. */
export function stripFlags(text: string): string {
  return text.replace(REGIONAL_PAIR, '').replace(/\s{2,}/g, ' ').trim()
}

/* Re-exported so renderer code has one import surface for masking. */
export { maskIp as maskIpLocal, maskAddress, maskMiddle, maskUrl } from '@shared/bridge'
