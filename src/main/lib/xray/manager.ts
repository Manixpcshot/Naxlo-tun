/**
 * Connection manager.
 *
 * Owns the whole lifecycle: core resolution → config generation → process
 * supervision → local-port readiness → optional system proxy → verification
 * through the proxy. Everything is reported as `AppState` so the renderer can
 * animate the transitions.
 */
import { dirname } from 'node:path'
import net from 'node:net'
import { log } from '../logger'
import { redact, registerSecret } from '../redact'
import { getSettings } from '../settings'
import { getVault, updateVault } from '../secretStore'
import { downloadCore, findCore, latestReleaseTag, readVersion, type CoreLocation } from './core'
import { buildXrayConfig, validateConfig } from './config'
import { cleanupStaleConfigs, startCore, type RunHandle } from './runner'
import { fetchIdentityThroughProxy, requestThroughProxy, tcpPing, waitForPort } from '../net'
import { applySystemProxy, readSystemProxy, restoreSystemProxy } from '../systemProxy'
import { getState, patchCore, patchState, setConnection, toast } from '../../state'
import { maskAddress, PINNED_XRAY_VERSION, type ServerConfig } from '../../../shared/bridge'

const SCOPE = 'xray'

class XrayManager {
  private handle: RunHandle | null = null
  private stopping = false
  private busy = false
  private activeServerId: string | null = null
  private core: CoreLocation | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  /** Injected by the bootstrap layer to avoid an import cycle. */
  autoRefreshHandler: (() => Promise<void>) | null = null

  async init(): Promise<void> {
    cleanupStaleConfigs()
    await this.refreshCoreStatus()
    const settings = getSettings()
    const proxyState = await readSystemProxy()
    const ours = `${settings.listenAddress}:${settings.httpPort}`
    if (proxyState.applied && proxyState.server === ours) {
      log.warn(SCOPE, 'leftover system proxy from a previous session found — restoring')
      try {
        await restoreSystemProxy()
        patchState({ systemProxyApplied: false })
      } catch (err) {
        log.error(SCOPE, 'could not restore leftover proxy', err)
      }
    }
    this.scheduleAutoRefresh()
  }

  /* ---------------------------------------------------------------- core */

  async refreshCoreStatus(): Promise<CoreLocation | null> {
    const settings = getSettings()
    const found = await findCore(settings.corePath)
    this.core = found
    patchCore({
      ready: Boolean(found),
      path: found ? found.path : null,
      version: found ? (found.version ?? PINNED_XRAY_VERSION) : null,
      source: found ? found.source : null,
      error: null
    })
    if (!found && getState().connection !== 'connected') setConnection('core-missing')
    if (found && getState().connection === 'core-missing') setConnection('idle')
    return found
  }

  async ensureCore(): Promise<CoreLocation> {
    const existing = await this.refreshCoreStatus()
    if (existing) return existing

    patchCore({ downloading: true, progress: 0, error: null })
    toast('info', 'در حال دریافت هستهٔ Xray', 'برای نخستین اجرا هستهٔ رسمی Xray دانلود و اعتبارسنجی می‌شود.')
    try {
      const path = await downloadCore((progress) => {
        const total = progress.total ?? 0
        patchCore({ progress: total ? Math.min(1, progress.received / total) : null })
      })
      const version = await readVersion(path)
      this.core = { path, version, source: 'downloaded' }
      patchCore({
        ready: true,
        downloading: false,
        progress: null,
        path,
        version,
        source: 'downloaded',
        error: null
      })
      if (getState().connection === 'core-missing') setConnection('idle')
      toast('success', 'هستهٔ Xray آماده است', `نسخهٔ ${version ?? PINNED_XRAY_VERSION}`)
      return this.core
    } catch (err) {
      const message = redact(err)
      patchCore({ downloading: false, progress: null, ready: false, error: message })
      toast('error', 'دریافت هسته ناموفق بود', message)
      throw err instanceof Error ? err : new Error(message)
    }
  }

  async checkCoreUpdate(): Promise<{ current: string | null; latest: string | null; updateAvailable: boolean }> {
    const current = this.core?.version ?? null
    const latestTag = await latestReleaseTag()
    const latest = latestTag ? latestTag.replace(/^v/, '') : null
    return { current, latest, updateAvailable: Boolean(latest && current && latest !== current) }
  }

  async setCustomCore(path: string): Promise<CoreLocation> {
    const version = await readVersion(path)
    if (!version) throw new Error('فایل انتخاب‌شده یک هستهٔ Xray معتبر نیست')
    this.core = { path, version, source: 'custom' }
    patchCore({ ready: true, path, version, source: 'custom', error: null })
    if (getState().connection === 'core-missing') setConnection('idle')
    log.info(SCOPE, 'custom core registered')
    return this.core
  }

  /* ------------------------------------------------------------ connect */

  async connect(serverId?: string): Promise<void> {
    if (this.busy) {
      toast('warning', 'عملیات در جریان است', 'لطفاً تا پایان کار فعلی صبر کنید.')
      return
    }
    const vault = getVault()
    const id = serverId ?? vault.selectedServerId
    const server = vault.servers.find((s) => s.id === id)
    if (!server) {
      setConnection('error', 'سروری برای اتصال انتخاب نشده است')
      toast('error', 'سروری انتخاب نشده', 'ابتدا یک کانفیگ را از فهرست سرورها انتخاب کنید.')
      return
    }
    const invalid = validateConfig(server)
    if (invalid) {
      setConnection('error', invalid)
      toast('error', 'کانفیگ نامعتبر', invalid)
      return
    }

    this.busy = true
    this.stopping = false
    try {
      registerSecret(server.credential, 'credential')
      registerSecret(server.pbk, 'pbk')
      registerSecret(server.address, 'address')

      updateVault({ selectedServerId: server.id })
      this.activeServerId = server.id
      patchState({
        selectedServerId: server.id,
        activeServerId: server.id,
        activeServerName: server.name,
        activeServerAddressMasked: maskAddress(server.address),
        lastError: null,
        identity: null,
        latencyMs: null,
        startedAt: null
      })
      setConnection('preparing')

      const core = await this.ensureCore()
      const settings = getSettings()

      if (await portInUse(settings.listenAddress, settings.socksPort)) {
        throw new Error(`پورت ${settings.socksPort} توسط برنامهٔ دیگری اشغال شده است`)
      }
      if (await portInUse(settings.listenAddress, settings.httpPort)) {
        throw new Error(`پورت ${settings.httpPort} توسط برنامهٔ دیگری اشغال شده است`)
      }

      setConnection('starting')
      const geoDir = dirname(core.path)
      const config = buildXrayConfig({ server, settings, geoDir })
      const handle = startCore({
        corePath: core.path,
        config,
        geoDir,
        onOutput: (line) => {
          if (/failed|error|panic/i.test(line)) log.warn('xray:out', line)
        }
      })
      this.handle = handle

      void handle.exited.then(async ({ code, signal }) => {
        if (this.stopping || this.handle !== handle) return
        this.handle = null
        log.error(SCOPE, `core exited unexpectedly (code=${code}, signal=${signal})`)
        await this.cleanupAfterFailure(
          `هستهٔ Xray به شکل غیرمنتظره بسته شد (کد ${code ?? signal ?? 'نامشخص'})`
        )
      })

      const ready = await waitForPort(settings.listenAddress, settings.httpPort, 9000)
      if (!ready) throw new Error('ایجاد پروکسی محلی ناموفق بود؛ پورت داخلی پاسخ نمی‌دهد')

      if (settings.applySystemProxy) {
        try {
          await applySystemProxy(settings.listenAddress, settings.httpPort)
          patchState({ systemProxyApplied: true })
        } catch (err) {
          log.warn(SCOPE, 'system proxy could not be applied — staying in manual mode', err)
          toast(
            'warning',
            'پروکسی سیستم تنظیم نشد',
            'پروکسی محلی فعال است؛ می‌توانید دستی روی پورت HTTP تنظیم کنید.'
          )
        }
      }

      const probe = await requestThroughProxy(settings.listenAddress, settings.httpPort, settings.testUrl, 15000)
      if (!probe.ok) {
        throw new Error(probe.error ? `تست اتصال ناموفق: ${probe.error}` : `تست اتصال ناموفق (کد ${probe.status})`)
      }

      patchState({ startedAt: Date.now(), latencyMs: probe.ms })
      setConnection('connected')
      updateVault({ lastConnectedAt: Date.now() })
      log.info(SCOPE, `connected to ${server.name} in ${probe.ms}ms`)
      toast('success', 'اتصال برقرار شد', `${server.name} • ${probe.ms}ms`)

      void this.refreshIdentity()
    } catch (err) {
      const message = err instanceof Error ? redact(err.message) : redact(err)
      log.error(SCOPE, 'connect failed', message)
      await this.cleanupAfterFailure(message)
      toast('error', 'اتصال برقرار نشد', message)
    } finally {
      this.busy = false
    }
  }

  async disconnect(reason = 'user'): Promise<void> {
    this.stopping = true
    const handle = this.handle
    this.handle = null
    if (handle) setConnection('stopping')

    if (handle) {
      try {
        await handle.stop(reason)
      } catch (err) {
        log.error(SCOPE, 'could not stop core cleanly', err)
      }
    }

    try {
      const proxy = await readSystemProxy()
      const settings = getSettings()
      if (proxy.applied && proxy.server === `${settings.listenAddress}:${settings.httpPort}`) {
        await restoreSystemProxy()
      }
    } catch (err) {
      log.error(SCOPE, 'could not restore system proxy', err)
    }

    patchState({
      systemProxyApplied: false,
      startedAt: null,
      latencyMs: null,
      identity: null,
      activeServerId: null,
      activeServerName: null,
      activeServerAddressMasked: null,
      lastError: null
    })
    this.activeServerId = null
    this.stopping = false
    this.busy = false
    setConnection('idle')
    log.info(SCOPE, `disconnected (${reason})`)
    if (reason === 'user') toast('info', 'اتصال قطع شد')
  }

  /** Emergency teardown used on app quit. */
  async shutdown(): Promise<void> {
    this.stopping = true
    try {
      if (this.handle) {
        await this.handle.stop('shutdown')
        this.handle = null
      }
      const proxy = await readSystemProxy()
      const settings = getSettings()
      if (proxy.applied && proxy.server === `${settings.listenAddress}:${settings.httpPort}`) {
        await restoreSystemProxy()
      }
    } catch (err) {
      log.error(SCOPE, 'shutdown cleanup failed', err)
    }
  }

  private async cleanupAfterFailure(message: string): Promise<void> {
    this.stopping = true
    const handle = this.handle
    this.handle = null
    if (handle) {
      try {
        await handle.stop('failure')
      } catch {
        /* ignore */
      }
    }
    try {
      const proxy = await readSystemProxy()
      const settings = getSettings()
      if (proxy.applied && proxy.server === `${settings.listenAddress}:${settings.httpPort}`) {
        await restoreSystemProxy()
      }
    } catch {
      /* ignore */
    }
    patchState({ systemProxyApplied: false, startedAt: null, latencyMs: null, identity: null })
    this.stopping = false
    setConnection('error', message)
  }

  async refreshIdentity(): Promise<void> {
    const settings = getSettings()
    if (!this.handle) return
    const identity = await fetchIdentityThroughProxy(settings.listenAddress, settings.httpPort, 10000)
    if (identity && this.handle) {
      patchState({ identity })
      log.info(SCOPE, 'public identity refreshed')
    }
  }

  /* ---------------------------------------------------------- latencies */

  async testServer(serverId: string): Promise<number | null> {
    const server = getVault().servers.find((s) => s.id === serverId)
    if (!server || !server.address || !server.port) return null
    const latency = await tcpPing(server.address, server.port, 5000)
    this.storeLatency(serverId, latency)
    return latency
  }

  async testAll(limit = 400): Promise<number> {
    const servers = getVault().servers.filter((s) => s.supported).slice(0, limit)
    log.info(SCOPE, `testing latency for ${servers.length} servers`)
    const concurrency = 12
    let index = 0
    const worker = async (): Promise<void> => {
      while (index < servers.length) {
        const current = servers[index++]
        const latency = await tcpPing(current.address, current.port, 4000)
        this.storeLatency(current.id, latency)
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, servers.length)) }, worker))
    toast('success', 'تست تأخیر انجام شد', `${servers.length} سرور بررسی شد`)
    return servers.length
  }

  private storeLatency(serverId: string, latency: number | null): void {
    const vault = getVault()
    const servers = vault.servers.map((s) =>
      s.id === serverId ? { ...s, latencyMs: latency, latencyAt: Date.now() } : s
    )
    updateVault({ servers })
  }

  /* ------------------------------------------------- subscription timer */

  scheduleAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    const minutes = getSettings().autoRefreshMinutes
    if (!minutes || minutes <= 0) return
    this.refreshTimer = setInterval(() => {
      if (!getVault().subscriptionUrl) return
      log.info(SCOPE, 'auto-refreshing subscription')
      void this.autoRefreshHandler?.()
    }, minutes * 60_000)
  }

  get isConnected(): boolean {
    return this.handle !== null
  }

  getActiveServer(): ServerConfig | null {
    if (!this.activeServerId) return null
    return getVault().servers.find((s) => s.id === this.activeServerId) ?? null
  }
}

function portInUse(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(500)
    const done = (result: boolean): void => {
      socket.destroy()
      resolve(result)
    }
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })
}

export const manager = new XrayManager()
