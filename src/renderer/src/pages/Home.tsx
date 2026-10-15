/**
 * Home — connection control, live status, latency sparkline and endpoints.
 */
import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon, type IconName } from '../components/Icon'
import { PowerButton } from '../components/PowerButton'
import { Sparkline } from '../components/Sparkline'
import { Flag } from '../components/Flag'
import { Button, Card, Notice, Progress } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'
import { fa, faDate, faDecimal, faDuration, faMs, formatBytes, maskIpLocal, shortDuration, subDaysLeft, subPercent, subRemaining, subUsed } from '../lib/format'
import type { PageId } from '../components/Sidebar'

interface Props {
  onNavigate: (page: PageId) => void
}

export function Home({ onNavigate }: Props): React.ReactElement {
  const { state, run, pushToast, settings } = useStore()
  const { t, pick } = useI18n()
  const [now, setNow] = useState(Date.now())
  const [ipVisible, setIpVisible] = useState(false)
  const [speed, setSpeed] = useState<{ mbps: number; bytes: number; ms: number } | null>(null)
  const [speedBusy, setSpeedBusy] = useState(false)
  const history = useRef<Array<number | null>>([])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (state.connection === 'connected' && state.latencyMs !== null) {
      history.current = [...history.current.slice(-39), state.latencyMs]
    }
    if (state.connection !== 'connected' && history.current.length) {
      history.current = []
    }
  }, [state.latencyMs, state.connection])

  useEffect(() => {
    if (state.connection !== 'connected') setSpeed(null)
  }, [state.connection])

  const connected = state.connection === 'connected'
  const busy = state.connection === 'preparing' || state.connection === 'starting' || state.connection === 'stopping'

  const statusKey: MsgKey = connected
    ? 'stateConnected'
    : state.connection === 'idle'
      ? 'stateIdle'
      : state.connection === 'error'
        ? 'stateError'
        : state.connection === 'core-missing'
          ? 'stateCoreMissing'
          : state.connection === 'stopping'
            ? 'stateStopping'
            : state.connection === 'preparing'
              ? 'statePreparing'
              : 'stateStarting'

  const hintKey: MsgKey = connected
    ? 'stateConnectedHint'
    : state.connection === 'idle'
      ? 'stateIdleHint'
      : state.connection === 'error'
        ? 'stateErrorHint'
        : state.connection === 'core-missing'
          ? 'stateCoreMissingHint'
          : state.connection === 'stopping'
            ? 'stateStoppingHint'
            : state.connection === 'preparing'
              ? 'statePreparingHint'
              : 'stateStartingHint'

  const toggle = async (): Promise<void> => {
    if (busy) return
    if (connected) await run(() => window.naxlo.connection.disconnect(), t('errorTitle'))
    else await run(() => window.naxlo.connection.connect(), t('errorTitle'))
  }

  const refresh = async (): Promise<void> => {
    if (state.subscriptions.length === 0) {
      onNavigate('subscription')
      return
    }
    const report = await run(() => window.naxlo.subscription.refresh(), t('errorTitle'))
    if (report) {
      const first = Array.isArray(report) ? report[0] : report
      if (first) {
        pushToast({
          kind: 'success',
          title: t('refreshedToast'),
          message: t('fetchedBody', { total: fa(first.total), supported: fa(first.supported) })
        })
      }
    }
  }

  const runSpeed = async (): Promise<void> => {
    setSpeedBusy(true)
    const result = await run(() => window.naxlo.speed.test(), t('errorTitle'))
    if (result) setSpeed(result)
    setSpeedBusy(false)
  }

  const uptime = state.startedAt ? now - state.startedAt : null
  const activeSub = state.subscriptions.find((sub) => sub.id === state.activeSubscriptionId) ?? null
  const activePercent = activeSub?.userinfo ? subPercent(activeSub.userinfo) : null
  const activeRemaining = activeSub?.userinfo ? subRemaining(activeSub.userinfo) : null
  const activeDays = activeSub?.userinfo ? subDaysLeft(activeSub.userinfo) : null

  return (
    <div>
      <motion.section
        className="card home-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="home-hero__glow" aria-hidden="true" data-tone={connected ? 'connected' : state.connection === 'error' ? 'error' : 'idle'} />

        <div className="home-hero__inner">
          <div className="home-hero__power">
            <PowerButton connection={state.connection} onClick={() => void toggle()} disabled={busy} label={connected ? t('disconnect') : t('connect')} />
          </div>

          <div className="home-hero__text">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={statusKey}
                className="home-hero__title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
              >
                {t(statusKey)}
              </motion.h2>
            </AnimatePresence>

            <p className="home-hero__hint">
              {connected && state.activeServerName
                ? t('homeTrafficVia', { name: state.activeServerName })
                : t(hintKey)}
            </p>

            <div className="home-hero__actions">
              <Button variant="primary" icon={connected ? 'disconnect' : 'bolt'} onClick={() => void toggle()} loading={busy}>
                {connected ? t('disconnect') : t('connect')}
              </Button>
              <Button icon="refresh" onClick={() => void refresh()} loading={state.subscriptions.some((sub) => sub.fetching)} disabled={busy}>
                {t('refreshSubscription')}
              </Button>
              <Button variant="ghost" icon="servers" onClick={() => onNavigate('servers')}>
                {t('chooseServer')}
              </Button>
              {connected || state.systemProxyApplied ? (
                <Button
                  variant="danger"
                  icon="power"
                  title={t('panicHint')}
                  onClick={() => void run(() => window.naxlo.connection.panic(), t('errorTitle'))}
                >
                  {t('panicTitle')}
                </Button>
              ) : null}
            </div>

            {connected ? (
              <motion.div className="home-hero__spark" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <Sparkline values={history.current} />
              </motion.div>
            ) : null}
          </div>
        </div>

        <AnimatePresence>
          {state.core.downloading ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: 18 }}>
              <Progress value={state.core.progress} indeterminate={state.core.progress === null} label={t('downloadingCore')} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.section>

      <AnimatePresence>
        {state.lastError ? (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginTop: 16 }}>
            <Notice kind="danger" icon="error" title={t('errorTitle')}>
              {pick(state.lastError)}
            </Notice>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state.connection === 'core-missing' ? (
        <div style={{ marginTop: 16 }}>
          <Notice kind="warning" icon="cpu" title={t('coreMissingTitle')}>
            {t('coreMissingBody')}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="sm" variant="primary" icon="download" onClick={() => void run(() => window.naxlo.core.ensure(), t('errorTitle'))}>
                {t('downloadCore')}
              </Button>
              <Button size="sm" icon="folder" onClick={() => void run(() => window.naxlo.core.pick(), t('errorTitle'))}>
                {t('pickCoreFile')}
              </Button>
            </div>
          </Notice>
        </div>
      ) : null}

      <div className="grid grid--4" style={{ marginTop: 18 }}>
        <Stat
          icon="globe"
          label={t('statIp')}
          value={
            state.identity ? (
              <span className="reveal mono" onClick={() => setIpVisible((v) => !v)} title={ipVisible ? t('hideIp') : t('showIp')}>
                {state.identity.countryCode ? <Flag code={state.identity.countryCode} /> : null}
                {ipVisible ? state.identity.ip : maskIpLocal(state.identity.ip)}
                <span className="reveal__eye">
                  <Icon name={ipVisible ? 'eyeOff' : 'eye'} size={13} />
                </span>
              </span>
            ) : (
              '—'
            )
          }
          foot={
            state.identity?.country
              ? state.identity.country
              : connected
                ? t('statIpFootConnected')
                : t('statIpFootIdle')
          }
        />
        <Stat icon="gauge" label={t('statLatency')} value={faMs(state.latencyMs)} foot={connected ? t('statLatencyFoot') : '—'} />
        <Stat icon="clock" label={t('statUptime')} value={shortDuration(uptime)} foot={uptime ? faDuration(uptime) : '—'} />
        <Stat
          icon="shield"
          label={t('statProxyMode')}
          value={state.systemProxyApplied ? t('proxyModeSystem') : t('proxyModeManual')}
          foot={
            settings.applySystemProxy
              ? state.systemProxyApplied
                ? t('proxyModeApplied')
                : t('proxyModePending')
              : t('proxyModeOff')
          }
        />
      </div>

      {activeSub ? (
        <Card className="quotacard" style={{ marginTop: 18 }}>
          <div className="endpoints__head">
            <div>
              <div className="card__title">
                <Icon name="subscription" size={15} /> {t('usageTitle')}
              </div>
              <div className="card__subtitle">{activeSub.name ?? activeSub.maskedUrl}</div>
            </div>
            <div className="quotacard__speed">
              <span className="badge badge--muted" title={t('speedHint')}>
                <Icon name="gauge" size={12} /> {t('speedTitle')}
              </span>
              <span className="quotacard__speedvalue mono">
                {speed ? t('speedValue', { n: faDecimal(speed.mbps) }) : '—'}
              </span>
              <Button size="sm" icon="gauge" onClick={() => void runSpeed()} loading={speedBusy} disabled={!connected} title={connected ? t('speedHint') : t('speedNeedConnect')}>
                {t('speedRun')}
              </Button>
            </div>
          </div>

          {activeSub.userinfo ? (
            <div className="usage" style={{ marginTop: 14 }}>
              <div className="usage__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={activePercent ?? 0}>
                <span
                  className="usage__fill"
                  data-tone={activePercent === null ? 'ok' : activePercent >= 90 ? 'danger' : activePercent >= 70 ? 'warn' : 'ok'}
                  style={{ width: `${activePercent ?? 4}%` }}
                />
              </div>
              <div className="usage__grid">
                <div className="usage__cell">
                  <span className="usage__label">{t('usageUsed')}</span>
                  <span className="usage__value">{formatBytes(subUsed(activeSub.userinfo))}</span>
                </div>
                <div className="usage__cell">
                  <span className="usage__label">{t('usageRemaining')}</span>
                  <span className="usage__value">
                    {activeRemaining === null ? t('usageUnlimited') : formatBytes(activeRemaining)}
                  </span>
                </div>
                <div className="usage__cell">
                  <span className="usage__label">{t('usageTotal')}</span>
                  <span className="usage__value">
                    {activeSub.userinfo.total ? formatBytes(activeSub.userinfo.total) : t('usageUnlimited')}
                  </span>
                </div>
                <div className="usage__cell">
                  <span className="usage__label">{t('usageExpire')}</span>
                  <span className="usage__value" data-tone={activeDays !== null && activeDays < 0 ? 'danger' : undefined}>
                    {activeSub.userinfo.expire
                      ? activeDays !== null && activeDays < 0
                        ? t('usageExpired')
                        : `${faDate(activeSub.userinfo.expire * 1000)}${activeDays !== null ? ` · ${t('usageDaysLeft', { n: fa(activeDays) })}` : ''}`
                      : t('usageNoExpiry')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="field__hint" style={{ marginTop: 12 }}>
              {t('usageNoQuota')}
            </p>
          )}
        </Card>
      ) : null}

      <Card className="endpoints">
        <div className="endpoints__head">
          <div>
            <div className="card__title">
              <Icon name="link" size={15} /> {t('endpointsTitle')}
            </div>
            <div className="card__subtitle">{t('endpointsSubtitle')}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon="copy"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`socks5://127.0.0.1:${state.socksPort}`)
                .then(() => pushToast({ kind: 'success', title: t('copiedSocks') }))
                .catch(() => pushToast({ kind: 'error', title: t('copyFailed') }))
            }}
          >
            {t('copySocks')}
          </Button>
        </div>

        <div className="grid grid--2" style={{ marginTop: 14 }}>
          <EndpointRow title="SOCKS5" value={`127.0.0.1:${state.socksPort}`} hint={t('socksHint')} />
          <EndpointRow title="HTTP" value={`127.0.0.1:${state.httpPort}`} hint={t('httpHint')} />
        </div>
      </Card>
    </div>
  )
}

function Stat({ icon, label, value, foot }: { icon: IconName; label: string; value: React.ReactNode; foot?: string }): React.ReactElement {
  return (
    <motion.div
      className="stat"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
    >
      <span className="stat__icon">
        <Icon name={icon} size={14} />
      </span>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {foot ? <span className="stat__foot">{foot}</span> : null}
    </motion.div>
  )
}

function EndpointRow({ title, value, hint }: { title: string; value: string; hint: string }): React.ReactElement {
  return (
    <div className="endpoint">
      <div className="endpoint__head">
        <span className="badge badge--accent">{title}</span>
        <span className="mono endpoint__value">{value}</span>
      </div>
      <span className="field__hint">{hint}</span>
    </div>
  )
}
