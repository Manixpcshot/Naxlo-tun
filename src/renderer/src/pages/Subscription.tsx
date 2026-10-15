/**
 * Subscription — paste, fetch, decode, inspect. Bilingual.
 */
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Button, Card, Field, Modal, Notice, PageHeader, Segmented } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'
import { fa, faRelative } from '../lib/format'
import type { PageId } from '../components/Sidebar'

interface Props {
  onNavigate: (page: PageId) => void
}

const REFRESH_OPTIONS: Array<{ value: string; key: MsgKey }> = [
  { value: '0', key: 'refreshOff' },
  { value: '60', key: 'refreshHourly' },
  { value: '360', key: 'refresh6h' },
  { value: '720', key: 'refresh12h' },
  { value: '1440', key: 'refreshDaily' }
]

export function Subscription({ onNavigate }: Props): React.ReactElement {
  const { state, settings, saveSettings, run, pushToast, reloadServers } = useStore()
  const { t, pick } = useI18n()
  const [url, setUrl] = useState('')
  const [visible, setVisible] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [revealing, setRevealing] = useState(false)

  const save = async (): Promise<void> => {
    if (!url.trim()) {
      pushToast({ kind: 'warning', title: t('emptyUrlToast') })
      return
    }
    const report = await run(() => window.naxlo.subscription.save(url.trim()), t('errorTitle'))
    if (report) {
      pushToast({
        kind: 'success',
        title: t('fetchedToast'),
        message: t('fetchedBody', { total: fa(report.total), supported: fa(report.supported) })
      })
      await reloadServers()
      setUrl('')
      setVisible(false)
      if (report.total > 0) onNavigate('servers')
    }
  }

  const refresh = async (): Promise<void> => {
    const report = await run(() => window.naxlo.subscription.refresh(), t('errorTitle'))
    if (report) {
      pushToast({ kind: 'success', title: t('refreshedToast'), message: t('fetchedBody', { total: fa(report.total), supported: fa(report.supported) }) })
      await reloadServers()
    }
  }

  const importFile = async (): Promise<void> => {
    const report = await run(() => window.naxlo.subscription.importFile(), t('errorTitle'))
    if (report && 'total' in report) {
      pushToast({ kind: 'success', title: t('importedToast'), message: t('importedBody', { total: fa(report.total) }) })
      await reloadServers()
    }
  }

  const reveal = async (): Promise<void> => {
    setRevealing(true)
    const value = await run(() => window.naxlo.subscription.reveal(), t('errorTitle'))
    setRevealing(false)
    if (value) {
      setUrl(value)
      setVisible(true)
    }
  }

  const sub = state.subscription

  return (
    <div>
      <PageHeader
        title={t('subscriptionTitle')}
        description={t('subscriptionDesc')}
        actions={
          <>
            <Button icon="refresh" onClick={() => void refresh()} loading={sub.fetching} disabled={!sub.hasUrl}>
              {t('refresh')}
            </Button>
            <Button icon="folder" onClick={() => void importFile()} disabled={sub.fetching}>
              {t('importFile')}
            </Button>
          </>
        }
      />

      <div className="grid grid--2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="subbox">
            <Field label={t('urlLabel')} hint={t('urlHint')} htmlFor="sub-url">
              <div className="input-group">
                <input
                  id="sub-url"
                  className="input input--mono"
                  type={visible ? 'text' : 'password'}
                  placeholder={t('urlPlaceholder')}
                  value={url}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void save()
                  }}
                />
                <Button variant="ghost" icon={visible ? 'eyeOff' : 'eye'} onClick={() => setVisible((v) => !v)} title={visible ? t('hide') : t('reveal')} className="btn--icon" />
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="primary" icon="download" onClick={() => void save()} loading={sub.fetching}>
                {t('saveAndFetch')}
              </Button>
              {sub.hasUrl ? (
                <>
                  <Button icon="eye" onClick={() => void reveal()} loading={revealing}>
                    {t('revealStored')}
                  </Button>
                  <Button variant="danger" icon="trash" onClick={() => setConfirmClear(true)}>
                    {t('deleteSubscription')}
                  </Button>
                </>
              ) : null}
            </div>

            <AnimatePresence>
              {sub.hasUrl ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Notice kind="accent" icon="lock" title={t('activeSubscription')}>
                    <span className="mono" style={{ direction: 'ltr', display: 'inline-block' }}>{sub.maskedUrl}</span>
                    <br />
                    {t('lastUpdate')} {faRelative(sub.lastUpdated) || t('never')}
                  </Notice>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {sub.lastError ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Notice kind="danger" icon="error" title={t('subErrorTitle')}>
                    {pick(sub.lastError)}
                  </Notice>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div className="card__title">
              <Icon name="activity" size={15} /> {t('subStatus')}
            </div>
            <div className="substats" style={{ marginTop: 14 }}>
              <MiniStat label={t('totalConfigs')} value={fa(sub.totalConfigs)} />
              <MiniStat label={t('supportedConfigs')} value={fa(sub.supportedConfigs)} />
              <MiniStat label={t('lastFetch')} value={faRelative(sub.lastUpdated) || t('never')} small />
              <MiniStat
                label={t('autoRefreshLabel')}
                value={settings.autoRefreshMinutes ? t(refreshKeyFor(settings.autoRefreshMinutes)) : t('refreshOff')}
                small
              />
            </div>
          </Card>

          <Card>
            <Field label={t('autoRefreshField')} hint={t('autoRefreshHint')}>
              <Segmented
                value={String(settings.autoRefreshMinutes)}
                options={REFRESH_OPTIONS.map((option) => ({ value: option.value, label: t(option.key) }))}
                onChange={(value) => void saveSettings({ autoRefreshMinutes: Number(value) })}
              />
            </Field>
          </Card>

          <Notice kind="accent" icon="shield" title={t('privacyTitle')}>
            {t('privacyBody')}
          </Notice>
        </div>
      </div>

      <Modal
        open={confirmClear}
        title={t('clearSubConfirmTitle')}
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                void run(() => window.naxlo.subscription.clear(), t('errorTitle')).then(async () => {
                  setConfirmClear(false)
                  await reloadServers()
                  pushToast({ kind: 'info', title: t('clearedSubToast') })
                })
              }}
            >
              {t('deleteAction')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t('cancel')}
            </Button>
          </>
        }
      >
        {t('clearSubConfirmBody')}
      </Modal>
    </div>
  )
}

function refreshKeyFor(minutes: number): MsgKey {
  if (minutes >= 1440) return 'refreshDaily'
  if (minutes >= 720) return 'refresh12h'
  if (minutes >= 360) return 'refresh6h'
  return 'refreshHourly'
}

function MiniStat({ label, value, small = false }: { label: string; value: string; small?: boolean }): React.ReactElement {
  return (
    <div className="stat" style={{ padding: 12 }}>
      <span className="stat__label">{label}</span>
      <span style={{ fontSize: small ? 13 : 17, fontWeight: 700 }}>{value}</span>
    </div>
  )
}
