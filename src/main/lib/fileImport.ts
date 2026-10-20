/**
 * Local config-file import (.txt / .json / .conf / .sub / .zip).
 *
 * Password-protected ZIP archives (classic ZipCrypto — the format WinRAR and
 * most locked config archives use) are decrypted with a user-supplied
 * password. The password is kept in the encrypted vault so a later refresh of
 * the same file never asks again, and it is registered with the redactor so it
 * can never reach the logs.
 *
 * The ZipCrypto stream cipher is implemented here directly (no native deps):
 * it is the standard PKWARE algorithm — three 32-bit keys driven by a CRC32
 * table, a 12-byte encryption header and a per-byte keystream.
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { tryDecodeBase64 } from './parseConfig'
import { AppError, L } from '../../shared/i18n'

const LINK_PREFIX = /^(vless|vmess|trojan|ss|hy2|tuic):\/\//im
const TEXT_EXT = /\.(txt|text|json|conf|sub)$/i

/** Thrown when a ZIP entry is encrypted and no password was supplied. */
export class FilePasswordRequired extends Error {
  constructor() {
    super('file password required')
    this.name = 'FilePasswordRequired'
  }
}

/** Thrown when the supplied password failed to decrypt the archive. */
export class FilePasswordWrong extends Error {
  constructor(detail?: string) {
    super(detail ?? 'wrong file password')
    this.name = 'FilePasswordWrong'
  }
}

/* ------------------------------------------------------------------ zip id */

export function isZipBuffer(buf: Buffer): boolean {
  return (
    buf.length > 3 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  )
}

interface CentralEntry {
  flags: number
  method: number
  crc: number
  compSize: number
  uncompSize: number
  modTime: number
  name: string
  localOffset: number
}

function readCentralDirectory(buf: Buffer): CentralEntry[] {
  // Locate the End Of Central Directory record (scan the last 64 KiB).
  let eocd = -1
  const from = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= from; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new AppError(L('فایل زیپ معتبر نیست', 'Not a valid zip archive'))
  const count = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)

  const entries: CentralEntry[] = []
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) break
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    entries.push({
      flags: buf.readUInt16LE(offset + 8),
      method: buf.readUInt16LE(offset + 10),
      modTime: buf.readUInt16LE(offset + 12),
      crc: buf.readUInt32LE(offset + 16),
      compSize: buf.readUInt32LE(offset + 20),
      uncompSize: buf.readUInt32LE(offset + 24),
      name: buf.toString('utf8', offset + 46, offset + 46 + nameLen),
      localOffset: buf.readUInt32LE(offset + 42)
    })
    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** Synchronous scan: does any entry carry the "encrypted" flag? */
export function zipNeedsPassword(buf: Buffer): boolean {
  if (!isZipBuffer(buf)) return false
  try {
    return readCentralDirectory(buf).some((entry) => (entry.flags & 0x1) === 1)
  } catch {
    // Fall back to a raw signature scan for malformed archives.
    for (let i = 0; i + 46 <= buf.length; i++) {
      if (buf.readUInt32LE(i) === 0x02014b50 && (buf.readUInt16LE(i + 8) & 0x1) === 1) return true
    }
    return false
  }
}

/** WinZip-AES (compression method 99) archives are not supported. */
export function zipUsesAes(buf: Buffer): boolean {
  if (!isZipBuffer(buf)) return false
  try {
    return readCentralDirectory(buf).some((entry) => entry.method === 99)
  } catch {
    for (let i = 0; i + 46 <= buf.length; i++) {
      if (buf.readUInt32LE(i) === 0x02014b50 && buf.readUInt16LE(i + 10) === 99) return true
    }
    return false
  }
}

/* -------------------------------------------------------------- zip crypto */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32Step(crc: number, byte: number): number {
  return (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0
}

export function crc32Buf(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) crc = crc32Step(crc, byte)
  return (crc ^ 0xffffffff) >>> 0
}

class ZipKeys {
  private k0 = 305419896
  private k1 = 591751049
  private k2 = 878082192

  constructor(password: string) {
    for (const byte of Buffer.from(password, 'utf8')) this.update(byte)
  }

  private update(byte: number): void {
    this.k0 = crc32Step(this.k0, byte)
    this.k1 = (Math.imul((this.k1 + (this.k0 & 0xff)) >>> 0, 134775813) + 1) >>> 0
    this.k2 = crc32Step(this.k2, (this.k1 >>> 24) & 0xff)
  }

  nextByte(): number {
    const temp = (this.k2 | 2) >>> 0
    return (Math.imul(temp, temp ^ 1) >>> 8) & 0xff
  }

  decrypt(cipher: Buffer): Buffer {
    const out = Buffer.alloc(cipher.length)
    for (let i = 0; i < cipher.length; i++) {
      // PKWARE reference: XOR first, then feed the *plaintext* byte to the keys.
      out[i] = cipher[i] ^ this.nextByte()
      this.update(out[i])
    }
    return out
  }

  /** @internal Test helper: mirrors `decrypt` for building fixtures. */
  encrypt(plain: Buffer): Buffer {
    const out = Buffer.alloc(plain.length)
    for (let i = 0; i < plain.length; i++) {
      const p = plain[i]
      out[i] = p ^ this.nextByte()
      this.update(p)
    }
    return out
  }
}

/** @internal Test helper: build the 12-byte header + encrypted payload. */
export function zipCryptoEncrypt(data: Buffer, password: string, checkByte: number): Buffer {
  const keys = new ZipKeys(password)
  const header = Buffer.alloc(12)
  for (let i = 0; i < 11; i++) header[i] = Math.floor(Math.random() * 256)
  header[11] = checkByte & 0xff
  return Buffer.concat([keys.encrypt(header), keys.encrypt(data)])
}

/* ------------------------------------------------------------ extraction */

function pickEntry(entries: CentralEntry[]): CentralEntry {
  const files = entries.filter((entry) => !entry.name.endsWith('/'))
  if (files.length === 0) throw new AppError(L('آرشیو خالی بود', 'The archive was empty'))
  return (
    files.find((entry) => TEXT_EXT.test(entry.name) && entry.uncompSize > 0) ??
    files.find((entry) => entry.uncompSize > 0) ??
    files[0]
  )
}

function extractEntry(buf: Buffer, entry: CentralEntry, password?: string | null): Buffer {
  const lo = entry.localOffset
  if (lo + 30 > buf.length || buf.readUInt32LE(lo) !== 0x04034b50) {
    throw new AppError(L('ساختار زیپ خراب است', 'The zip archive is malformed'))
  }
  const nameLen = buf.readUInt16LE(lo + 26)
  const extraLen = buf.readUInt16LE(lo + 28)
  const dataStart = lo + 30 + nameLen + extraLen
  let payload = buf.subarray(dataStart, dataStart + entry.compSize)

  if ((entry.flags & 0x1) === 1) {
    if (!password) throw new FilePasswordRequired()
    const keys = new ZipKeys(password)
    const header = keys.decrypt(payload.subarray(0, 12))
    const expected =
      (entry.flags & 0x8) === 0x8 ? (entry.modTime >>> 8) & 0xff : (entry.crc >>> 24) & 0xff
    payload = keys.decrypt(payload.subarray(12))
    // With a data descriptor the header check can legitimately differ — the
    // CRC below is then the source of truth.
    if (header[11] !== expected && (entry.flags & 0x8) === 0) throw new FilePasswordWrong()
  }

  let data: Buffer
  try {
    if (entry.method === 0) data = Buffer.from(payload)
    else if (entry.method === 8) data = inflateRawSync(payload)
    else if (entry.method === 99) {
      throw new AppError(
        L(
          'زیپ با رمزنگاری AES پشتیبانی نمی‌شود؛ فایل را با رمز ZipCrypto (استاندارد WinRAR) ذخیره کنید',
          'AES-encrypted zips are not supported; save the archive with a classic (ZipCrypto) password'
        )
      )
    } else {
      throw new AppError(
        L(`فشرده‌سازی زیپ پشتیبانی نمی‌شود (method ${entry.method})`, `Unsupported zip compression (method ${entry.method})`)
      )
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    const message = err instanceof Error ? err.message : String(err)
    if ((entry.flags & 0x1) === 1) throw new FilePasswordWrong(message)
    throw new AppError(L(`باز کردن آرشیو ناموفق بود: ${message}`, `Could not open the archive: ${message}`))
  }

  if (crc32Buf(data) !== entry.crc) {
    if ((entry.flags & 0x1) === 1) throw new FilePasswordWrong('crc mismatch')
    throw new AppError(L('فایل زیپ خراب است (CRC نامعتبر)', 'The zip archive is corrupted (bad CRC)'))
  }
  return data
}

/** Extract the most config-like entry of a zip archive. */
export function extractFromZip(buf: Buffer, password?: string | null): { name: string; data: Buffer } {
  const entry = pickEntry(readCentralDirectory(buf))
  return { name: entry.name, data: extractEntry(buf, entry, password) }
}

/* --------------------------------------------------------------- payloads */

/**
 * Subscription payloads are usually base64 of the link list; some are the
 * links themselves. Try both, preferring the readable interpretation.
 */
export function decodeSubscriptionBytes(buf: Buffer): string {
  const asText = buf.toString('utf8')
  if (LINK_PREFIX.test(asText.trim())) return asText
  const decoded = tryDecodeBase64(asText)
  if (decoded && LINK_PREFIX.test(decoded)) return decoded
  return decoded ?? asText
}

export function fileNameOf(filePath: string): string {
  return basename(filePath.replace(/\\/g, '/'))
}

/**
 * Read a config file from disk and return the decoded link-list text.
 * ZIPs are unpacked in memory; encrypted ZIPs need `password`.
 */
export function readConfigFile(filePath: string, password?: string | null): string {
  if (!existsSync(filePath)) throw new AppError(L('فایل پیدا نشد', 'File not found'))
  const buf = readFileSync(filePath)
  if (!isZipBuffer(buf)) return decodeSubscriptionBytes(buf)
  if (zipUsesAes(buf)) {
    throw new AppError(
      L(
        'زیپ با رمزنگاری AES پشتیبانی نمی‌شود؛ فایل را با رمز ZipCrypto (استاندارد WinRAR) ذخیره کنید',
        'AES-encrypted zips are not supported; save the archive with a classic (ZipCrypto) password'
      )
    )
  }
  const { data } = extractFromZip(buf, password)
  return decodeSubscriptionBytes(data)
}
