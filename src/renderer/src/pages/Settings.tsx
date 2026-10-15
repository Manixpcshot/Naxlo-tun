/**
 * Settings — bilingual, with language, auto-update and danger zone.
 */
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Button, Card, Field, Modal, Notice, PageHeader, Progress, Segmented, Toggle } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'
import { ROUTE_MODE_KEY } from '../lib/labels'
import { fa } from '../lib/format'
import type { Lang, RouteMode, Settings as SettingsType } from '@shared/bridge'

const ACCENTS: Array<{ id: SettingsType['accent']; color: string }> = [
  { id: 'cyan', color: '#22d3ee' },
  { id: 'violet', color: '#9b8cfb' },
  { id: 'emerald', color: '#3fd6a4' },
  { id: 'amber', color: '#e8b268' },
  { id: 'rose', color: '#f08a9b' }
]

const LOG_LEVELS: Array<{ value: SettingsType['logLevel']; key: MsgKey }> = [
  { value: 'error', key: 'logError' },
  { value: 'warn', key: 'logWarn' },
  { value: 'info', key: 'logInfo' },
  { value: 'debug', key: 'logDebug' }
]

export function Settings(): React.ReactElement {
  const { settings, saveSettings, state, run, pushToast, info } = useStore()
  const { t, pick, lang, setLang } = useI18n()
  const [updateInfo, setUpdateInfo] = useState<{ current: string | null; latest: string | null; updateAvailable: boolean } | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState(false)

  const patch = (partial: Partial<SettingsType>): void => {
    void saveSettings(partial).catch(() => pushToast({ kind: 'error', title: t('saveSettingsFailed') }))
  }

  const numberField = (key: 'socksPort' | 'httpPort', value: number): React.ReactElement => (
    <input
      className="input input--mono"
      type="number"
      min={1024}
      max={65535}
      value={value}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next) && next >= 1024 && next <= 65535) patch({ [key]: next } as Partial<SettingsType>)
      }}
    />
  )

  const routeKey = (mode: RouteMode): MsgKey => ROUTE_MODE_KEY[mode]

  return (
    <div>
      <PageHeader title={t('settingsTitle')} description={t('settingsDesc')} />

      <div className="settings-grid">
        <div className="setting-col">
          <Card>
            <div className="card__title">
              <Icon name="link" size={15} /> {t('localProxySection')}
            </div>
            <div className="card__subtitle">{t('localProxyDesc')}</div>

            <div className="grid grid--2" style={{ marginTop: 16 }}>
              <Field label={t('socksPort')} hint={t('socksPortHint')}>
                {numberField('socksPort', settings.socksPort)}
              </Field>
              <Field label={t('httpPort')} hint={t('httpPortHint')}>
                {numberField('httpPort', settings.httpPort)}
              </Field>
            </div>

            <div className="toggle-stack">
              <Toggle
                checked={settings.applySystemProxy}
                onChange={(value) => patch({ applySystemProxy: value })}
                title={t('applySystemProxy')}
                description={t('applySystemProxyDesc')}
              />
              <Toggle
                checked={settings.autoConnectLast}
                onChange={(value) => patch({ autoConnectLast: value })}
                title={t('autoConnectLast')}
                description={t('autoConnectLastDesc')}
              />
            </div>
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="filter" size={15} /> {t('routingSection')}
            </div>

            <div className="setting-stack">
              <Field label={t('routeModeLabel')} hint={t(`${routeKey(settings.routeMode)}Hint` as MsgKey)}>
                <Segmented<RouteMode>
                  value={settings.routeMode}
                  options={(Object.keys(ROUTE_MODE_KEY) as RouteMode[]).map((mode) => ({
                    value: mode,
                    label: t(routeKey(mode))
                  }))}
                  onChange={(mode) => patch({ routeMode: mode })}
                />
              </Field>

              <Toggle checked={settings.blockAds} onChange={(value) => patch({ blockAds: value })} title={t('blockAds')} description={t('blockAdsDesc')} />
              <Toggle checked={settings.muxEnabled} onChange={(value) => patch({ muxEnabled: value })} title={t('mux')} description={t('muxDesc')} />
              {settings.muxEnabled ? (
                <Field label={t('muxConcurrency', { n: fa(settings.muxConcurrency) })}>
                  <input
                    type="range"
                    min={1}
                    max={32}
                    value={settings.muxConcurrency}
                    onChange={(event) => patch({ muxConcurrency: Number(event.target.value) })}
                    className="range"
                  />
                </Field>
              ) : null}
              <Toggle
                checked={settings.allowInsecure}
                onChange={(value) => patch({ allowInsecure: value })}
                title={t('allowInsecure')}
                description={t('allowInsecureDesc')}
              />
            </div>
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="globe" size={15} /> {t('testSection')}
            </div>
            <div className="card__subtitle">{t('testSectionDesc')}</div>
            <div style={{ marginTop: 14 }}>
              <Field label={t('testUrlLabel')} hint={t('testUrlHint')}>
                <input className="input input--mono" value={settings.testUrl} spellCheck={false} onChange={(event) => patch({ testUrl: event.target.value })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="setting-col">
          <Card>
            <div className="card__title">
              <Icon name="cpu" size={15} /> {t('coreSection')}
            </div>
            <div className="kv" style={{ marginTop: 14 }}>
              <span className="kv__key">{t('coreStatus')}</span>
              <span className="kv__val">{state.core.ready ? <span className="badge badge--success">{t('coreReady')}</span> : <span className="badge badge--danger">{t('coreMissing')}</span>}</span>
              <span className="kv__key">{t('coreVersion')}</span>
              <span className="kv__val mono">{state.core.version ?? '—'}</span>
              <span className="kv__key">{t('coreSource')}</span>
              <span className="kv__val">
                {state.core.source === 'bundled'
                  ? t('coreSourceBundled')
                  : state.core.source === 'downloaded'
                    ? t('coreSourceDownloaded')
                    : state.core.source === 'custom'
                      ? t('coreSourceCustom')
                      : state.core.source === 'dev'
                        ? t('coreSourceDev')
                        : '—'}
              </span>
              <span className="kv__key">{t('corePath')}</span>
              <span className="kv__val mono" style={{ fontSize: 11 }}>
                {state.core.path ?? '—'}
              </span>
            </div>

            <div className="btn-row">
              <Button
                icon="download"
                variant="primary"
                onClick={() => void run(() => window.naxlo.core.ensure(), t('errorTitle'))}
                loading={state.core.downloading}
              >
                {state.core.ready ? t('coreInstall') : t('coreDownload')}
              </Button>
              <Button icon="folder" onClick={() => void run(() => window.naxlo.core.pick(), t('errorTitle'))}>
                {t('corePickFile')}
              </Button>
              <Button
                icon="refresh"
                variant="ghost"
                onClick={async () => {
                  const info2 = await run(() => window.naxlo.core.checkUpdate(), t('errorTitle'))
                  if (info2) {
                    setUpdateInfo(info2)
                    pushToast({
                      kind: info2.updateAvailable ? 'info' : 'success',
                      title: info2.updateAvailable ? t('coreUpdateAvailable') : t('coreUpToDate'),
                      message: info2.updateAvailable && info2.latest ? t('coreUpdateBody', { current: info2.current ?? '—', latest: info2.latest }) : undefined
                    })
                  }
                }}
              >
                {t('coreCheckUpdate')}
              </Button>
            </div>

            <AnimatePresence>
              {state.core.downloading ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ marginTop: 14 }}>
                  <Progress
                    value={state.core.progress}
                    indeterminate={state.core.progress === null}
                    label={state.core.progress === null ? t('connectingLabel') : t('downloadingLabel', { n: fa(Math.round((state.core.progress ?? 0) * 100)) })}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {updateInfo?.updateAvailable ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: 14 }}>
                  <Notice kind="warning" icon="alert" title={t('coreUpdateAvailable')}>
                    {t('coreUpdateBody', { current: updateInfo.current ?? '—', latest: updateInfo.latest ?? '—' })}
                  </Notice>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {state.core.error ? (
              <div style={{ marginTop: 14 }}>
                <Notice kind="danger" icon="error" title={t('coreErrorTitle')}>
                  {pick(state.core.error)}
                </Notice>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="download" size={15} /> {t('updateSection')}
            </div>
            <div className="card__subtitle">{t('updateSectionDesc')}</div>

            <div className="setting-stack">
              <Toggle
                checked={settings.autoUpdate}
                onChange={(value) => patch({ autoUpdate: value })}
                title={t('autoUpdateToggle')}
                description={info ? undefined : t('devBuildNote')}
              />

              <AnimatePresence>
                {state.update.ready && state.update.downloadedVersion ? (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Notice kind="accent" icon="bolt" title={t('updateReady', { v: state.update.downloadedVersion })}>
                      {t('updateReadyBody')}
                      <div style={{ marginTop: 10 }}>
                        <Button size="sm" variant="primary" icon="play" onClick={() => void window.naxlo.app.installUpdate().catch(() => undefined)}>
                          {t('installNow')}
                        </Button>
                      </div>
                    </Notice>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {state.update.downloading ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Progress
                      value={state.update.progress}
                      indeterminate={state.update.progress === null}
                      label={t('updateDownloading', { v: state.update.availableVersion ?? '…' })}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="btn-row">
                <Button
                  icon="refresh"
                  onClick={async () => {
                    const result = await run(() => window.naxlo.app.checkUpdate(), t('errorTitle'))
                    if (result) {
                      pushToast({
                        kind: result.updateAvailable ? 'info' : 'success',
                        title: result.updateAvailable ? t('appUpdateAvailable') : t('appUpToDate'),
                        message: result.updateAvailable
                          ? t('appUpdateAvailableBody', { v: result.latest ?? '—' })
                          : t('appUpToDateBody', { v: result.current })
                      })
                    }
                  }}
                  loading={state.update.checking}
                >
                  {t('checkAppUpdate')}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="settings" size={15} /> {t('behaviourSection')}
            </div>
            <div className="setting-stack">
              <Field label={t('languageField')}>
                <Segmented<Lang>
                  value={lang}
                  options={[
                    { value: 'fa', label: t('languageFa') },
                    { value: 'en', label: t('languageEn') },
                    { value: 'tr', label: t('languageTr') }
                  ]}
                  onChange={(value) => setLang(value)}
                />
              </Field>
              <Toggle checked={settings.autoStart} onChange={(value) => patch({ autoStart: value })} title={t('autoStart')} />
              <Toggle
                checked={settings.minimizeToTray}
                onChange={(value) => patch({ minimizeToTray: value })}
                title={t('minimizeToTray')}
                description={t('minimizeToTrayDesc')}
              />
              <Toggle checked={settings.reduceMotion} onChange={(value) => patch({ reduceMotion: value })} title={t('reduceMotion')} description={t('reduceMotionDesc')} />

              <Field label={t('accentField')}>
                <div className="accent-picker">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      className={`accent-dot ${settings.accent === accent.id ? 'accent-dot--active' : ''}`}
                      style={{ background: accent.color }}
                      title={accent.id}
                      aria-label={accent.id}
                      onClick={() => patch({ accent: accent.id })}
                    />
                  ))}
                </div>
              </Field>

              <Field label={t('logLevelField')}>
                <Segmented
                  value={settings.logLevel}
                  options={LOG_LEVELS.map((level) => ({ value: level.value, label: t(level.key) }))}
                  onChange={(value) => patch({ logLevel: value as SettingsType['logLevel'] })}
                />
              </Field>
            </div>
          </Card>

          <Card className="danger">
            <div className="card__title" style={{ color: 'var(--danger)' }}>
              <Icon name="alert" size={15} /> {t('dangerSection')}
            </div>
            <div className="card__subtitle">{t('dangerDesc')}</div>
            <div className="btn-row">
              <Button variant="danger" icon="trash" onClick={() => setConfirmWipe(true)} loading={wiping}>
                {t('wipeAction')}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmWipe}
        title={t('wipeConfirmTitle')}
        onClose={() => setConfirmWipe(false)}
        actions={
          <>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                setWiping(true)
                void run(async () => {
                  await window.naxlo.connection.disconnect()
                  await window.naxlo.subscription.clear()
                  await window.naxlo.settings.set({ corePath: null })
                }, t('errorTitle')).then(() => {
                  setWiping(false)
                  setConfirmWipe(false)
                  pushToast({ kind: 'info', title: t('wipedToast') })
                })
              }}
            >
              {t('clearAction')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
              {t('cancel')}
            </Button>
          </>
        }
      >
        {t('wipeConfirmBody')}
      </Modal>
    </div>
  )
}
