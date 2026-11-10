/**
 * Stats — usage statistics from the encrypted vault: daily connection time,
 * session counts, most-used servers and the speed-test history. All charts
 * are hand-rolled (SVG/flex) and animated; time flows right→left in RTL.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Flag } from '../components/Flag'
import { Sparkline } from '../components/Sparkline'
import { Button, Card, PageHeader } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n } from '../lib/i18n'
import { extractFlagCodes, fa, faDecimal, minutesLabel, stripFlags } from '../lib/format'
import { aggregateStats, summarizeToday } from '@shared/stats'
import type { StatsPayload } from '@shared/bridge'

const DAYS = 14

export function Stats(): React.ReactElement {
  const { state, settings, run, pushToast } = useStore()
  const { t } = useI18n()
  const reduce = settings.reduceMotion
  const [stats, setStats] = useState<StatsPayload | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    const next = await run(() => window.naxlo.stats.get(), t('errorTitle'))
    if (next) setStats(next)
  }, [run, t])

  useEffect(() => {
    void reload()
  }, [reload])

  // A closed session lands in the vault when the connection drops — refresh.
  useEffect(() => {
    if (state.connection === 'idle' || state.connection === 'error') void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.connection])

  const summary = useMemo(
    () => aggregateStats(stats?.sessions ?? [], DAYS, Date.now()),
    [stats]
  )
  const speed = useMemo(() => stats?.speed ?? [], [stats])
  const bestSpeed = useMemo(
    () => (speed.length > 0 ? Math.max(...speed.map((s) => s.mbps)) : null),
    [speed]
  )

  const today = useMemo(() => summarizeToday(stats?.sessions ?? [], speed, Date.now()), [stats, speed])

  const maxMinutes = Math.max(1, ...summary.daily.map((d) => d.minutes))
  const maxServer = Math.max(1, ...summary.topServers.map((s) => s.minutes))
  const empty = summary.totalSessions === 0 && speed.length === 0

  const todayTiles = [
    { icon: 'clock' as const, label: t('statsTodayMinutes'), value: minutesLabel(today.minutes) },
    { icon: 'activity' as const, label: t('statsTodaySessions'), value: fa(today.sessions) },
    { icon: 'bolt' as const, label: t('statsTodayBest'), value: today.bestMbps !== null ? `${faDecimal(today.bestMbps)} Mbps` : '—' },
    { icon: 'gauge' as const, label: t('statsTodayAvg'), value: today.avgMbps !== null ? `${faDecimal(today.avgMbps)} Mbps` : '—' }
  ]

  const tiles = [
    { icon: 'clock' as const, label: t('statsTotalTime'), value: minutesLabel(summary.totalMinutes) },
    { icon: 'activity' as const, label: t('statsSessions'), value: fa(summary.totalSessions) },
    { icon: 'gauge' as const, label: t('statsAvgSession'), value: minutesLabel(summary.avgMinutes) },
    { icon: 'bolt' as const, label: t('statsBestSpeed'), value: bestSpeed !== null ? `${fa(bestSpeed)} Mbps` : '—' }
  ]

  return (
    <div>
      <PageHeader
        title={t('statsTitle')}
        description={t('statsDesc')}
        actions={
          <Button
            variant="danger"
            icon="trash"
            disabled={empty}
            onClick={async () => {
              const next = await run(() => window.naxlo.stats.clear(), t('errorTitle'))
              if (next) {
                setStats(next)
                pushToast({ kind: 'info', title: t('statsCleared') })
              }
            }}
          >
            {t('statsClear')}
          </Button>
        }
      />

      <div className="grid grid--4 statgrid">
        {tiles.map((tile) => (
          <Card key={tile.label} className="stattile">
            <div className="stattile__icon">
              <Icon name={tile.icon} size={15} />
            </div>
            <div className="stattile__value">{tile.value}</div>
            <div className="stattile__label">{tile.label}</div>
          </Card>
        ))}
      </div>

      <Card className="statscard" style={{ marginTop: 16 }}>
        <div className="card__title">
          <Icon name="activity" size={15} /> {t('statsTodayTitle')}
        </div>
        {today.sessions === 0 && today.speedSamples === 0 ? (
          <div className="card__subtitle">{t('statsTodayEmpty')}</div>
        ) : (
          <>
            <div className="grid grid--4 statgrid" style={{ marginTop: 10 }}>
              {todayTiles.map((tile) => (
                <div key={tile.label} className="stattile stattile--inline">
                  <div className="stattile__icon">
                    <Icon name={tile.icon} size={14} />
                  </div>
                  <div className="stattile__value">{tile.value}</div>
                  <div className="stattile__label">{tile.label}</div>
                </div>
              ))}
            </div>
            {today.deltaPercent !== null ? (
              <div className="card__subtitle">{t('statsTodayDelta', { p: fa(today.deltaPercent) })}</div>
            ) : null}
          </>
        )}
      </Card>

      <Card className="statscard" style={{ marginTop: 16 }}>
        <div className="card__title">
          <Icon name="clock" size={15} /> {t('statsDailyTitle')}
        </div>
        {summary.totalSessions === 0 ? (
          <div className="card__subtitle">{t('statsEmpty')}</div>
        ) : (
          <div className="daychart" role="img" aria-label={t('statsDailyTitle')}>
            {summary.daily.map((bucket, index) => {
              const isToday = index === summary.daily.length - 1
              const pct = Math.round((bucket.minutes / maxMinutes) * 100)
              const day = Number(bucket.date.slice(8))
              return (
                <div key={bucket.date} className={`daychart__col ${isToday ? 'daychart__col--today' : ''}`}>
                  <div className="daychart__track" title={`${bucket.date} — ${minutesLabel(bucket.minutes)}`}>
                    <motion.div
                      className="daychart__bar"
                      initial={reduce ? { height: `${Math.max(pct, bucket.minutes > 0 ? 4 : 1)}%` } : { height: '1%' }}
                      animate={{ height: `${Math.max(pct, bucket.minutes > 0 ? 4 : 1)}%` }}
                      transition={{ duration: 0.5, delay: reduce ? 0 : index * 0.03, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="daychart__label">{fa(day)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid grid--2" style={{ marginTop: 16 }}>
        <Card className="statscard">
          <div className="card__title">
            <Icon name="servers" size={15} /> {t('statsTopServers')}
          </div>
          {summary.topServers.length === 0 ? (
            <div className="card__subtitle">{t('statsEmpty')}</div>
          ) : (
            <div className="toplist">
              {summary.topServers.map((server, index) => {
                const code = extractFlagCodes(server.serverName)[0] ?? null
                const name = stripFlags(server.serverName) || server.serverName
                const pct = Math.round((server.minutes / maxServer) * 100)
                return (
                  <motion.div
                    key={server.serverId}
                    className="toplist__row"
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <span className="toplist__flag">{code ? <Flag code={code} /> : null}</span>
                    <span className="toplist__name" title={name}>{name}</span>
                    <span className="toplist__meta">{fa(server.sessions)}× • {minutesLabel(server.minutes)}</span>
                    <span className="toplist__track">
                      <motion.span
                        className="toplist__bar"
                        initial={reduce ? { width: `${pct}%` } : { width: '0%' }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: reduce ? 0 : 0.15 + index * 0.05 }}
                      />
                    </span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="statscard">
          <div className="card__title">
            <Icon name="gauge" size={15} /> {t('statsSpeedTitle')}
          </div>
          {speed.length < 2 ? (
            <div className="card__subtitle">{t('statsNoSpeed')}</div>
          ) : (
            <div className="speedwrap">
              <Sparkline values={speed.map((s) => s.mbps)} width={340} height={72} />
              <div className="speedwrap__meta">
                <span className="badge badge--muted">{t('statsSpeedLast')}: {fa(speed[speed.length - 1].mbps)} Mbps</span>
                <span className="badge badge--muted">{t('statsBestSpeed')}: {fa(bestSpeed ?? 0)} Mbps</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
