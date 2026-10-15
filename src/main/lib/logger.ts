/**
 * Ring-buffer + file logger.
 *
 * Two hard guarantees:
 *   1. Every message is passed through `redact()` before it is stored.
 *   2. The renderer only ever receives the already-redacted ring buffer.
 */
import { app } from 'electron'
import { createWriteStream, existsSync, mkdirSync, statSync, renameSync, type WriteStream } from 'node:fs'
import { join } from 'node:path'
import { redact } from './redact'
import type { LogEntry, LogLevel } from '../../shared/types'

const MAX_MEMORY = 500
const MAX_FILE_BYTES = 2 * 1024 * 1024

let buffer: LogEntry[] = []
let seq = 0
let stream: WriteStream | null = null
let logFile = ''
let minLevel: LogLevel = 'info'
let listeners: Array<(entry: LogEntry) => void> = []

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  core: 20,
  info: 30,
  warn: 40,
  error: 50
}

export function initLogger(level: LogLevel = 'info'): void {
  minLevel = level
  try {
    const dir = join(app.getPath('userData'), 'logs')
    mkdirSync(dir, { recursive: true })
    logFile = join(dir, 'naxlo.log')
    rotateIfNeeded(logFile)
    stream = createWriteStream(logFile, { flags: 'a', mode: 0o600 })
  } catch (err) {
    // Logging must never break the app; fall back to memory only.
    // eslint-disable-next-line no-console
    console.warn('logger: file output unavailable', err instanceof Error ? err.message : '')
  }
}

function rotateIfNeeded(file: string): void {
  try {
    if (existsSync(file) && statSync(file).size > MAX_FILE_BYTES) {
      renameSync(file, `${file}.1`)
    }
  } catch {
    /* ignore */
  }
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level
}

export function onLog(listener: (entry: LogEntry) => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function write(level: LogLevel, scope: string, message: unknown, meta?: unknown): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel] && level !== 'error') return
  let text = redact(message)
  if (meta !== undefined) text += ` ${redact(meta)}`
  if (text.length > 2000) text = `${text.slice(0, 2000)}…`

  const entry: LogEntry = { id: ++seq, at: Date.now(), level, scope, message: text }
  buffer.push(entry)
  if (buffer.length > MAX_MEMORY) buffer = buffer.slice(buffer.length - MAX_MEMORY)

  if (stream) {
    stream.write(`${new Date(entry.at).toISOString()} [${level.toUpperCase()}] (${scope}) ${text}\n`)
  }
  for (const l of listeners) {
    try {
      l(entry)
    } catch {
      /* a broken listener must not break logging */
    }
  }
}

export const log = {
  debug: (scope: string, msg: unknown, meta?: unknown) => write('debug', scope, msg, meta),
  info: (scope: string, msg: unknown, meta?: unknown) => write('info', scope, msg, meta),
  warn: (scope: string, msg: unknown, meta?: unknown) => write('warn', scope, msg, meta),
  error: (scope: string, msg: unknown, meta?: unknown) => write('error', scope, msg, meta),
  core: (scope: string, msg: unknown, meta?: unknown) => write('core', scope, msg, meta)
}

export function getLogs(limit = MAX_MEMORY): LogEntry[] {
  return buffer.slice(-limit)
}

export function clearLogs(): void {
  buffer = []
  if (stream && logFile) {
    try {
      stream.end()
      rotateIfNeeded(logFile)
      stream = createWriteStream(logFile, { flags: 'w', mode: 0o600 })
    } catch {
      /* ignore */
    }
  }
}

export function closeLogger(): void {
  try {
    stream?.end()
  } catch {
    /* ignore */
  }
  stream = null
  listeners = []
}
