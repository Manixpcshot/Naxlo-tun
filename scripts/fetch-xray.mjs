#!/usr/bin/env node
/**
 * Fetch the official Xray-core binary for bundling.
 *
 * Usage:
 *   node scripts/fetch-xray.mjs [--version v26.3.27] [--platform win32] [--arch x64]
 *
 * The binary is downloaded from the official XTLS/Xray-core GitHub release,
 * verified against the published digest and extracted into `resources/xray`.
 * It is never committed to Git (see .gitignore) — CI runs this step before
 * packaging so installers ship with a working core.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'XTLS/Xray-core'

function readPinnedVersion() {
  const typesFile = join(root, 'src', 'shared', 'types.ts')
  const source = readFileSync(typesFile, 'utf8')
  const match = /PINNED_XRAY_VERSION\s*=\s*'([^']+)'/.exec(source)
  if (!match) throw new Error('could not read PINNED_XRAY_VERSION from src/shared/types.ts')
  return match[1]
}

function parseArgs(argv) {
  const args = { version: readPinnedVersion(), platform: process.platform, arch: process.arch }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (key === '--version') args.version = argv[++i]
    else if (key === '--platform') args.platform = argv[++i]
    else if (key === '--arch') args.arch = argv[++i]
    else if (key === '--help') args.help = true
  }
  return args
}

function assetFor(platform, arch) {
  if (platform === 'win32') {
    if (arch === 'arm64') return 'Xray-windows-arm64-v8a.zip'
    if (arch === 'ia32' || arch === 'x86') return 'Xray-windows-32.zip'
    return 'Xray-windows-64.zip'
  }
  if (platform === 'darwin') return arch === 'arm64' ? 'Xray-macos-arm64-v8a.zip' : 'Xray-macos-64.zip'
  if (arch === 'arm64') return 'Xray-linux-arm64-v8a.zip'
  return 'Xray-linux-64.zip'
}

function log(message) {
  process.stdout.write(`  ${message}\n`)
}

async function fetchBuffer(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    log('usage: node scripts/fetch-xray.mjs [--version vX.Y.Z] [--platform win32|darwin|linux] [--arch x64|arm64]')
    return
  }

  const tag = args.version.startsWith('v') ? args.version : `v${args.version}`
  const asset = assetFor(args.platform, args.arch)
  const url = `https://github.com/${REPO}/releases/download/${tag}/${asset}`
  const outDir = join(root, 'resources', 'xray')
  const exeName = args.platform === 'win32' ? 'xray.exe' : 'xray'
  const target = join(outDir, exeName)

  log(`naxlo — fetching Xray core ${tag} (${args.platform}/${args.arch})`)
  log(`asset: ${asset}`)

  if (existsSync(target)) {
    log(`already present: ${target}`)
    return
  }

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  log('downloading…')
  const bytes = await fetchBuffer(url)
  log(`downloaded ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB`)

  log('verifying digest…')
  let verified = false
  try {
    const dgst = Buffer.from(await fetchBuffer(`${url}.dgst`)).toString('utf8')
    const sha512 = /SHA512\s*\(base64\)\s*=\s*([A-Za-z0-9+/=]+)/i.exec(dgst)
    const sha256 = /SHA256\s*\(base64\)\s*=\s*([A-Za-z0-9+/=]+)/i.exec(dgst)
    if (sha512) {
      verified = createHash('sha512').update(Buffer.from(bytes)).digest('base64') === sha512[1]
      log(verified ? 'SHA-512 OK' : 'SHA-512 MISMATCH')
    } else if (sha256) {
      verified = createHash('sha256').update(Buffer.from(bytes)).digest('base64') === sha256[1]
      log(verified ? 'SHA-256 OK' : 'SHA-256 MISMATCH')
    } else {
      log('no digest found in .dgst file — continuing without verification')
      verified = true
    }
  } catch (error) {
    log(`digest unavailable (${error.message}) — continuing without verification`)
    verified = true
  }

  if (!verified) {
    rmSync(outDir, { recursive: true, force: true })
    throw new Error('checksum verification failed — refusing to bundle')
  }

  log('extracting…')
  const files = unzipSync(bytes)
  let count = 0
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith('/')) continue
    const outPath = join(outDir, name)
    if (!outPath.startsWith(outDir)) continue // zip-slip guard
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, Buffer.from(data))
    count++
  }
  log(`extracted ${count} files to ${outDir}`)

  if (!existsSync(target)) {
    const found = Object.keys(files).find((name) => /^xray(\.exe)?$/i.test(name))
    if (!found) throw new Error(`executable ${exeName} not found inside the archive`)
    log(`executable found as ${found}`)
  } else {
    log(`ready: ${target}`)
  }
}

main().catch((error) => {
  process.stderr.write(`\n  fetch-xray failed: ${error.message}\n\n`)
  process.exitCode = 1
})
