/**
 * Settings (non-secret) persistence.
 *
 * Ports, theme, routing mode and friends live in plain JSON inside userData.
 * Anything that identifies a server or a subscription belongs to the encrypted
 * vault instead — see `secretStore.ts`.
 */
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '../../shared/types'
import { log } from './logger'

const SCOPE = 'settings'
let cache: Settings = { ...DEFAULT_SETTINGS }
let filePath = ''

function file(): string {
  if (!filePath) filePath = join(app.getPath('userData'), 'settings.json')
  return filePath
}

export function loadSettings(): Settings {
  try {
    if (existsSync(file())) {
      const parsed = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Settings>
      cache = { ...DEFAULT_SETTINGS, ...parsed }
    } else {
      cache = { ...DEFAULT_SETTINGS }
      persist()
    }
  } catch (err) {
    log.warn(SCOPE, 'could not read settings, falling back to defaults', err)
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export function getSettings(): Settings {
  return cache
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cache = { ...cache, ...patch }
  persist()
  return cache
}

export function resetSettings(): Settings {
  cache = { ...DEFAULT_SETTINGS }
  persist()
  return cache
}

function persist(): void {
  try {
    const target = file()
    mkdirSync(dirname(target), { recursive: true })
    const tmp = `${target}.tmp`
    writeFileSync(tmp, JSON.stringify(cache, null, 2), { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, target)
  } catch (err) {
    log.error(SCOPE, 'could not persist settings', err)
  }
}
