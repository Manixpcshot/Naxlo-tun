/**
 * Bilingual strings (Persian / English).
 *
 * Everything user-facing that originates in the main process is wrapped with
 * `L(fa, en)` so the renderer can render it in the active language. Errors that
 * must survive IPC use `AppError`, whose payload travels inside the envelope.
 */

export type Lang = 'fa' | 'en' | 'tr'

import { TR_MAIN } from './i18n-tr-main'

export interface LString {
  fa: string
  en: string
  /** Turkish variant; optional — the renderer falls back to English. */
  tr?: string
}

/**
 * Wrap a main-process string. Static English texts are matched against the
 * generated Turkish table; interpolated strings should pass `tr` explicitly.
 */
export const L = (fa: string, en: string, tr?: string): LString => {
  const value = tr ?? TR_MAIN[en]
  return value ? { fa, en, tr: value } : { fa, en }
}

export function isLString(value: unknown): value is LString {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LString).fa === 'string' &&
    typeof (value as LString).en === 'string'
  )
}

export function pickL(value: string | LString | null | undefined, lang: Lang): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  // Turkish falls back to English when no translation is registered.
  return lang === 'tr' ? (value.tr ?? value.en) : value[lang]
}

/** Error with a bilingual message; `message` stays Persian for legacy paths. */
export class AppError extends Error {
  readonly localized: LString
  constructor(localized: LString) {
    super(localized.fa)
    this.name = 'AppError'
    this.localized = localized
  }
}

export function toLString(error: unknown): LString {
  if (error instanceof AppError) return error.localized
  if (isLString(error)) return error
  if (error instanceof Error) {
    const message = error.message
    return { fa: message, en: message }
  }
  const text = String(error)
  return { fa: text, en: text }
}
