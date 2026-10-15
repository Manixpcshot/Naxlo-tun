/**
 * Xray process runner.
 *
 * The generated configuration contains credentials, so it is written to a
 * 0600 file inside userData, handed to Xray once, and deleted as soon as the
 * process exits (and again at startup, in case of a crash). Console output is
 * piped through the redactor before it reaches the log ring buffer.
 */
import { app } from 'electron'
import { spawn, execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { log } from '../logger'
import { redact } from '../redact'

const SCOPE = 'xray:runner'

export interface RunHandle {
  pid: number
  /** Resolves when the process exits. */
  exited: Promise<{ code: number | null; signal: string | null }>
  stop: (reason?: string) => Promise<void>
  readonly configFile: string
}

export interface RunOptions {
  corePath: string
  config: Record<string, unknown>
  geoDir?: string | null
  onOutput?: (line: string, stream: 'stdout' | 'stderr') => void
}

/** Delete any configuration files left behind by a previous session. */
export function cleanupStaleConfigs(): void {
  try {
    const dir = configDir()
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      if (/^naxlo-.*\.json$/i.test(entry)) {
        try {
          unlinkSync(join(dir, entry))
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    log.warn(SCOPE, 'stale config cleanup failed', err)
  }
}

export function configDir(): string {
  return join(app.getPath('userData'), 'xray', 'run')
}

function writeConfigFile(config: Record<string, unknown>): string {
  const dir = configDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `naxlo-${randomBytes(6).toString('hex')}.json`)
  writeFileSync(file, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 })
  try {
    chmodSync(file, 0o600)
  } catch {
    /* best effort on Windows */
  }
  return file
}

export function startCore(options: RunOptions): RunHandle {
  const { corePath, config, geoDir, onOutput } = options
  const configFile = writeConfigFile(config)

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Keep the core quiet and predictable.
    XRAY_LOCATION_ASSET: geoDir || dirname(corePath),
    XRAY_CONFDIR: '',
    NO_COLOR: '1'
  }

  log.info(SCOPE, 'starting core')
  const child = spawn(corePath, ['run', '-c', configFile], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let lineBuffer = ''
  const handleChunk = (stream: 'stdout' | 'stderr') => (chunk: Buffer): void => {
    lineBuffer += chunk.toString('utf8')
    const lines = lineBuffer.split(/\r?\n/)
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      log.core(SCOPE, redact(line))
      onOutput?.(redact(line), stream)
    }
  }

  child.stdout?.on('data', handleChunk('stdout'))
  child.stderr?.on('data', handleChunk('stderr'))

  child.on('error', (err) => {
    log.error(SCOPE, 'core failed to spawn', err)
  })

  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once('exit', (code, signal) => {
      if (lineBuffer.trim()) {
        log.core(SCOPE, redact(lineBuffer.trim()))
        onOutput?.(redact(lineBuffer.trim()), 'stderr')
      }
      removeConfigFile(configFile)
      resolve({ code, signal })
    })
    child.once('close', () => removeConfigFile(configFile))
  })

  const stop = async (reason = 'user'): Promise<void> => {
    if (child.exitCode !== null || child.killed) {
      removeConfigFile(configFile)
      return
    }
    log.info(SCOPE, `stopping core (reason: ${reason})`)
    await killTree(child.pid, reason)
    removeConfigFile(configFile)
  }

  return { pid: child.pid ?? -1, exited, stop, configFile }
}

function removeConfigFile(file: string): void {
  try {
    if (existsSync(file)) rmSync(file, { force: true })
  } catch (err) {
    log.warn(SCOPE, 'could not remove config file', err)
  }
}

/** Kill the process *and* its children (Xray may fork helpers on Windows). */
export function killTree(pid: number | undefined, reason = 'stop'): Promise<void> {
  return new Promise((resolve) => {
    if (!pid || pid <= 0) {
      resolve()
      return
    }
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, (err) => {
        if (err) log.warn(SCOPE, `taskkill failed (${reason})`, err.message)
        resolve()
      })
      return
    }
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        /* already gone */
      }
    }
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        /* already gone */
      }
      resolve()
    }, 1200)
  })
}
