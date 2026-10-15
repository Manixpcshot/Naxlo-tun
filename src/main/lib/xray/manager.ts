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
import { AppError, L, toLString } from '../../../shared/i18n'

const SCOPE = 'xray'

class XrayManager {
  private handle: RunHandle | null = null
  private stopping = false
  private busy = false
  private activeServerId: string | null = null
  private core: CoreLocation | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  private latencyTimer: NodeJS.Timeout | null = null
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
    toast(
      'info',
      L('در حال دریافت هستهٔ Xray', 'Downloading the Xray core'),
      L('برای نخستین اجرا هستهٔ رسمی Xray دانلود و اعتبارسنجی می‌شود.', 'On first run the official Xray core is downloaded and verified.')
    )
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
      toast(
        'success',
        L('هستهٔ Xray آماده است', 'Xray core is ready'),
        L(`نسخهٔ ${version ?? PINNED_XRAY_VERSION}`, `Version ${version ?? PINNED_XRAY_VERSION}`)
      )
      return this.core
    } catch (err) {
      const localized = toLString(err)
      localized.fa = redact(localized.fa)
      localized.en = redact(localized.en)
      patchCore({ downloading: false, progress: null, ready: false, error: localized })
      toast('error', L('دریافت هسته ناموفق بود', 'Core download failed'), localized)
      throw err instanceof Error ? err : new AppError(localized)
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
    if (!version) {
      throw new AppError(L('فایل انتخاب‌شده یک هستهٔ Xray معتبر نیست', 'The selected file is not a valid Xray core'))
    }
    this.core = { path, version, source: 'custom' }
    patchCore({ ready: true, path, version, source: 'custom', error: null })
    if (getState().connection === 'core-missing') setConnection('idle')
    log.info(SCOPE, 'custom core registered')
    return this.core
  }

  /* ------------------------------------------------------------ connect */

  async connect(serverId?: string): Promise<void> {
    if (this.busy) {
      toast('warning', L('عملیات در جریان است', 'Operation in progress'), L('لطفاً تا پایان کار فعلی صبر کنید.', 'Please wait for the current task to finish.'))
      return
    }
    const vault = getVault()
    const id = serverId ?? vault.selectedServerId
    const server = vault.servers.find((s) => s.id === id)
    if (!server) {
      setConnection('error', L('سروری برای اتصال انتخاب نشده است', 'No server is selected'))
      toast(
        'error',
        L('سروری انتخاب نشده', 'No server selected'),
        L('ابتدا یک کانفیگ را از فهرست سرورها انتخاب کنید.', 'Pick a config from the server list first.')
      )
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
        activeSubscriptionId: server.subscriptionId,
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
        throw new AppError(
          L(
            `پورت ${settings.socksPort} توسط برنامهٔ دیگری اشغال شده است`,
            `Port ${settings.socksPort} is already used by another application`
          )
        )
      }
      if (await portInUse(settings.listenAddress, settings.httpPort)) {
        throw new AppError(
          L(
            `پورت ${settings.httpPort} توسط برنامهٔ دیگری اشغال شده است`,
            `Port ${settings.httpPort} is already used by another application`
          )
        )
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
          L(
            `هستهٔ Xray به شکل غیرمنتظره بسته شد (کد ${code ?? signal ?? 'نامشخص'})`,
            `The Xray core exited unexpectedly (code ${code ?? signal ?? 'unknown'})`
          )
        )
      })

      const ready = await waitForPort(settings.listenAddress, settings.httpPort, 9000)
      if (!ready) {
        throw new AppError(
          L('ایجاد پروکسی محلی ناموفق بود؛ پورت داخلی پاسخ نمی‌دهد', 'Local proxy failed to start — the inbound port is not responding')
        )
      }

      if (settings.applySystemProxy) {
        try {
          await applySystemProxy(settings.listenAddress, settings.httpPort)
          patchState({ systemProxyApplied: true })
        } catch (err) {
          log.warn(SCOPE, 'system proxy could not be applied — staying in manual mode', err)
          toast(
            'warning',
            L('پروکسی سیستم تنظیم نشد', 'System proxy could not be applied'),
            L('پروکسی محلی فعال است؛ می‌توانید دستی روی پورت HTTP تنظیم کنید.', 'The local proxy is running — you can point apps at the HTTP port manually.')
          )
        }
      }

      const probe = await requestThroughProxy(settings.listenAddress, settings.httpPort, settings.testUrl, 15000)
      if (!probe.ok) {
        throw new AppError(
          probe.error
            ? L(`تست اتصال ناموفق: ${probe.error}`, `Connection test failed: ${probe.error}`)
            : L(`تست اتصال ناموفق (کد ${probe.status})`, `Connection test failed (status ${probe.status})`)
        )
      }

      patchState({ startedAt: Date.now(), latencyMs: probe.ms })
      setConnection('connected')
      updateVault({ lastConnectedAt: Date.now() })
      this.startLatencyProbe()
      log.info(SCOPE, `connected to ${server.name} in ${probe.ms}ms`)
      toast('success', L('اتصال برقرار شد', 'Connected'), L(`${server.name} • ${probe.ms}ms`, `${server.name} • ${probe.ms}ms`))

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
    this.stopLatencyProbe()
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
      activeSubscriptionId: null,
      activeServerName: null,
      activeServerAddressMasked: null,
      lastError: null
    })
    this.activeServerId = null
    this.stopping = false
    this.busy = false
    setConnection('idle')
    log.info(SCOPE, `disconnected (${reason})`)
    if (reason === 'user') toast('info', L('اتصال قطع شد', 'Disconnected'))
  }

  /** Emergency teardown used on app quit. */
  async shutdown(): Promise<void> {
    this.stopping = true
    this.stopLatencyProbe()
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

  private async cleanupAfterFailure(message: string | import('../../../shared/i18n').LString): Promise<void> {
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

  /** Re-measure latency through the proxy so the UI sparkline stays alive. */
  private startLatencyProbe(): void {
    this.stopLatencyProbe()
    this.latencyTimer = setInterval(() => {
      if (!this.handle) {
        this.stopLatencyProbe()
        return
      }
      const settings = getSettings()
      void requestThroughProxy(settings.listenAddress, settings.httpPort, settings.testUrl, 8000).then((probe) => {
        if (probe.ok && this.handle) patchState({ latencyMs: probe.ms })
      })
    }, 25_000)
  }

  private stopLatencyProbe(): void {
    if (this.latencyTimer) {
      clearInterval(this.latencyTimer)
      this.latencyTimer = null
    }
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
    toast(
      'success',
      L('تست تأخیر انجام شد', 'Latency test finished'),
      L(`${servers.length} سرور بررسی شد`, `${servers.length} servers tested`)
    )
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
