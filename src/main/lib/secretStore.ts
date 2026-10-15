/**
 * Encrypted vault.
 *
 * Holds everything that identifies the user's service: the subscription URL,
 * the parsed server list and the last selection. On Windows this is protected
 * with Electron's `safeStorage` (DPAPI — bound to the user account). When the
 * platform keystore is unavailable we fall back to AES-256-GCM with a key
 * derived from machine-local material; that fallback is *obfuscation*, and the
 * UI says so explicitly.
 *
 * The vault file is written with 0600 permissions and the raw payload is never
 * logged, printed or handed to the renderer as-is.
 */
import { app, safeStorage } from 'electron'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  chmodSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto'
import { networkInterfaces, hostname, userInfo } from 'node:os'
import { log } from './logger'
import { registerSecret } from './redact'
import { bumpServers } from '../state'
import type { ServerConfig, StoredSubscription } from '../../shared/types'
import { stableId } from './ids'

const SCOPE = 'vault'
const VAULT_VERSION = 2
const APP_SALT = 'naxlo::vault::v2::sodium-chloride'

export interface VaultPayload {
  /** Legacy single-subscription fields, kept only to migrate old vaults. */
  subscriptionUrl: string | null
  subscriptionName: string | null
  subscriptions: StoredSubscription[]
  servers: ServerConfig[]
  selectedServerId: string | null
  lastConnectedAt: number | null
  lastUpdatedAt: number | null
}

type Alg = 'safeStorage' | 'aes-256-gcm'

interface VaultFile {
  v: number
  alg: Alg
  data: string
  iv?: string
  tag?: string
}

let payload: VaultPayload = {
  subscriptionUrl: null,
  subscriptionName: null,
  subscriptions: [],
  servers: [],
  selectedServerId: null,
  lastConnectedAt: null,
  lastUpdatedAt: null
}

let filePath = ''
let fallbackKey: Buffer | null = null
let dirty = false
let flushTimer: NodeJS.Timeout | null = null

function file(): string {
  if (!filePath) filePath = join(app.getPath('userData'), 'vault.bin')
  return filePath
}

export function vaultEncryptionKind(): Alg | 'none' {
  if (safeStorage.isEncryptionAvailable()) return 'safeStorage'
  return machineKey() ? 'aes-256-gcm' : 'none'
}

function machineKey(): Buffer | null {
  if (fallbackKey) return fallbackKey
  try {
    const ifaces = networkInterfaces()
    const mac = Object.values(ifaces)
      .flat()
      .find((i) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')?.mac
    let user = 'user'
    try {
      user = userInfo().username
    } catch {
      /* some sandboxes forbid this */
    }
    const material = `${hostname()}|${mac ?? 'no-mac'}|${user}|${app.getPath('userData')}`
    fallbackKey = scryptSync(material, APP_SALT, 32)
    return fallbackKey
  } catch (err) {
    log.warn(SCOPE, 'could not derive fallback key', err)
    return null
  }
}

function encrypt(json: string): VaultFile | null {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return { v: VAULT_VERSION, alg: 'safeStorage', data: safeStorage.encryptString(json).toString('base64') }
    } catch (err) {
      log.warn(SCOPE, 'safeStorage encryption failed, trying fallback', err)
    }
  }
  const key = machineKey()
  if (!key) return null
  try {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
    return {
      v: VAULT_VERSION,
      alg: 'aes-256-gcm',
      data: enc.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64')
    }
  } catch (err) {
    log.error(SCOPE, 'fallback encryption failed', err)
    return null
  }
}

function decrypt(vaultFile: VaultFile): string | null {
  try {
    if (vaultFile.alg === 'safeStorage' && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(vaultFile.data, 'base64'))
    }
    if (vaultFile.alg === 'aes-256-gcm' && vaultFile.iv && vaultFile.tag) {
      const key = machineKey()
      if (!key) return null
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(vaultFile.iv, 'base64'))
      decipher.setAuthTag(Buffer.from(vaultFile.tag, 'base64'))
      return Buffer.concat([
        decipher.update(Buffer.from(vaultFile.data, 'base64')),
        decipher.final()
      ]).toString('utf8')
    }
  } catch (err) {
    log.error(SCOPE, 'vault decryption failed', err)
  }
  return null
}

/** Teach the redactor about every secret currently held in memory. */
function armRedaction(): void {
  if (payload.subscriptionUrl) registerSecret(payload.subscriptionUrl, 'subscription')
  for (const sub of payload.subscriptions) registerSecret(sub.url, 'subscription')
  try {
    const u = payload.subscriptionUrl ? new URL(payload.subscriptionUrl) : null
    if (u) {
      registerSecret(u.pathname.replace(/^\//, ''), 'sub-path')
      if (u.search) registerSecret(u.search.slice(1), 'sub-query')
    }
  } catch {
    /* not a URL */
  }
  for (const s of payload.servers) {
    registerSecret(s.credential, 'credential')
    if (s.pbk) registerSecret(s.pbk, 'pbk')
    if (s.sid) registerSecret(s.sid, 'sid')
    if (s.quicKey) registerSecret(s.quicKey, 'quic-key')
    if (s.raw) registerSecret(s.raw, 'link')
    registerSecret(s.address, 'address')
  }
}

/**
 * Vaults written before 1.2.0 stored a single subscription URL. Lift it into
 * the multi-subscription list and re-attach its servers, so upgrading users
 * keep everything (name falls back to null → the UI shows the URL host).
 */
function migrateLegacySubscription(): void {
  if (payload.subscriptions.length > 0 || !payload.subscriptionUrl) return
  const id = stableId(payload.subscriptionUrl)
  payload.subscriptions = [
    {
      id,
      url: payload.subscriptionUrl,
      name: payload.subscriptionName,
      userinfo: null,
      updatedAt: payload.lastUpdatedAt,
      lastError: null
    }
  ]
  for (const server of payload.servers) {
    if (server.source === 'subscription' && !server.subscriptionId) server.subscriptionId = id
  }
  log.info(SCOPE, 'migrated legacy single-subscription vault to the multi-subscription list')
}

export function loadVault(): VaultPayload {
  try {
    if (existsSync(file())) {
      const raw = readFileSync(file(), 'utf8')
      const parsed = JSON.parse(raw) as VaultFile
      if (!parsed || typeof parsed !== 'object') throw new Error('malformed vault')
      const json = decrypt(parsed)
      if (json) {
        const data = JSON.parse(json) as Partial<VaultPayload>
        payload = {
          subscriptionUrl: typeof data.subscriptionUrl === 'string' ? data.subscriptionUrl : null,
          subscriptions: Array.isArray(data.subscriptions)
            ? (data.subscriptions as StoredSubscription[])
            : [],
          subscriptionName: typeof data.subscriptionName === 'string' ? data.subscriptionName : null,
          servers: Array.isArray(data.servers) ? (data.servers as ServerConfig[]) : [],
          selectedServerId: data.selectedServerId ?? null,
          lastConnectedAt: data.lastConnectedAt ?? null,
          lastUpdatedAt: data.lastUpdatedAt ?? null
        }
      } else {
        log.warn(SCOPE, 'vault could not be decrypted; starting empty')
      }
    }
  } catch (err) {
    log.error(SCOPE, 'vault load failed', err)
  }
  migrateLegacySubscription()
  armRedaction()
  log.info(
    SCOPE,
    `vault loaded (servers=${payload.servers.length}, subscription=${payload.subscriptionUrl ? 'yes' : 'no'}, protection=${vaultEncryptionKind()})`
  )
  return payload
}

export function getVault(): VaultPayload {
  return payload
}

export function updateVault(patch: Partial<VaultPayload>): VaultPayload {
  payload = { ...payload, ...patch }
  armRedaction()
  schedulePersist()
  if (patch.servers || patch.selectedServerId !== undefined) bumpServers()
  return payload
}

/** Replace the server list (used by subscription refresh / imports). */
export function replaceServers(servers: ServerConfig[]): void {
  payload.servers = servers
  if (payload.selectedServerId && !servers.some((s) => s.id === payload.selectedServerId)) {
    payload.selectedServerId = servers[0]?.id ?? null
  }
  armRedaction()
  schedulePersist()
  bumpServers()
}

function schedulePersist(): void {
  dirty = true
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (dirty) persistNow()
  }, 250)
}

export function persistNow(): void {
  dirty = false
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  try {
    const json = JSON.stringify(payload)
    const encrypted = encrypt(json)
    const target = file()
    mkdirSync(dirname(target), { recursive: true })
    if (!encrypted) {
      log.error(SCOPE, 'no encryption backend available; refusing to write plaintext secrets')
      return
    }
    const tmp = `${target}.tmp`
    writeFileSync(tmp, JSON.stringify(encrypted), { encoding: 'utf8', mode: 0o600 })
    try {
      chmodSync(tmp, 0o600)
    } catch {
      /* best effort on non-POSIX */
    }
    renameSync(tmp, target)
  } catch (err) {
    log.error(SCOPE, 'vault persist failed', err)
  }
}

export function wipeVault(): void {
  payload = {
    subscriptionUrl: null,
    subscriptionName: null,
    subscriptions: [],
    servers: [],
    selectedServerId: null,
    lastConnectedAt: null,
    lastUpdatedAt: null
  }
  try {
    if (existsSync(file())) rmSync(file())
  } catch (err) {
    log.error(SCOPE, 'vault wipe failed', err)
  }
  persistNow()
}

/** Constant-time-ish helper used by the reveal endpoint. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
