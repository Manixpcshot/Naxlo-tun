/**
 * Subscription — multiple subscriptions, each with its own quota, name and
 * server list. Bilingual (fa/en).
 */
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Button, Card, Field, Modal, Notice, PageHeader, Segmented } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'
import { fa, faDate, faRelative, formatBytes, subDaysLeft, subPercent, subRemaining, subUsed } from '../lib/format'
import type { PageId } from '../components/Sidebar'
import type { SubscriptionView } from '@shared/bridge'

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

function hostOf(maskedUrl: string): string {
  return maskedUrl.replace(/^https?:\/\//, '').split('/')[0] || maskedUrl
}

export function Subscription({ onNavigate }: Props): React.ReactElement {
  const { state, settings, saveSettings, run, pushToast, reloadServers } = useStore()
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [removing, setRemoving] = useState<SubscriptionView | null>(null)
  const [pwPrompt, setPwPrompt] = useState<{ path: string; wrong: boolean } | null>(null)
  const [pwValue, setPwValue] = useState('')

  const add = async (): Promise<void> => {
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
      if (report.total > 0) onNavigate('servers')
    }
  }

  const refreshOne = async (id: string): Promise<void> => {
    const report = await run(() => window.naxlo.subscription.refresh(id), t('errorTitle'))
    if (report && !Array.isArray(report)) {
      pushToast({
        kind: 'success',
        title: t('refreshedToast'),
        message: t('fetchedBody', { total: fa(report.total), supported: fa(report.supported) })
      })
      await reloadServers()
    }
  }

  const afterImport = async (
    report: Awaited<ReturnType<typeof window.naxlo.subscription.importFile>> | null | undefined
  ): Promise<void> => {
    if (!report || !('ok' in report)) return
    if (report.needPassword) {
      setPwPrompt({ path: report.filePath ?? '', wrong: Boolean(report.wrongPassword) })
      setPwValue('')
      return
    }
    setPwPrompt(null)
    if (report.ok) {
      pushToast({
        kind: 'success',
        title: t('importedToast'),
        message: t('fetchedBody', { total: fa(report.total), supported: fa(report.supported) })
      })
      await reloadServers()
      if (report.total > 0) onNavigate('servers')
    }
  }

  const importFile = async (): Promise<void> => {
    const report = await run(() => window.naxlo.subscription.importFile(), t('errorTitle'))
    await afterImport(report)
  }

  const submitFilePassword = async (): Promise<void> => {
    if (!pwPrompt) return
    const report = await run(
      () => window.naxlo.subscription.importFile(pwPrompt.path, pwValue),
      t('errorTitle')
    )
    await afterImport(report)
  }

  const reveal = async (sub: SubscriptionView): Promise<void> => {
    const value = await run(() => window.naxlo.subscription.reveal(sub.id), t('errorTitle'))
    if (value) setRevealed((prev) => ({ ...prev, [sub.id]: value }))
  }

  const copy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(value)
      pushToast({ kind: 'warning', title: t('copiedLinkTitle'), message: t('copiedLinkBody') })
    } catch {
      pushToast({ kind: 'error', title: t('copyFailed') })
    }
  }

  const remove = async (sub: SubscriptionView): Promise<void> => {
    const done = await run(() => window.naxlo.subscription.remove(sub.id), t('errorTitle'))
    if (done) {
      pushToast({ kind: 'info', title: t('removedToast'), message: sub.name ?? hostOf(sub.maskedUrl) })
      await reloadServers()
    }
    setRemoving(null)
  }

  return (
    <div>
      <PageHeader title={t('subscriptionTitle')} description={t('subsListDesc')} />

      <Card className="subadd">
        <div className="card__title">
          <Icon name="subscription" size={15} /> {t('subsAdd')}
        </div>
        <div className="card__subtitle">{t('subsAddHint')}</div>
        <div className="subadd__row">
          <input
            className="input mono"
            dir="ltr"
            placeholder={t('urlPlaceholder')}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add()
            }}
          />
          <Button variant="primary" icon="plus" onClick={() => void add()} disabled={!url.trim()}>
            {t('subsAdd')}
          </Button>
          <Button icon="folder" onClick={() => void importFile()}>
            {t('subImportFile')}
          </Button>
        </div>
      </Card>

      <div className="sublist__head">
        <span className="card__title">
          <Icon name="subscription" size={15} /> {t('subsList')}
        </span>
        <span className="badge badge--muted">{t('subsCount', { n: fa(state.subscriptions.length) })}</span>
      </div>

      {state.subscriptions.length === 0 ? (
        <Notice kind="default" icon="subscription" title={t('subsEmpty')}>
          {t('subsEmptyHint')}
        </Notice>
      ) : (
        <div className="sublist">
          <AnimatePresence initial={false}>
            {state.subscriptions.map((sub) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <SubCard
                  sub={sub}
                  revealedUrl={revealed[sub.id]}
                  onRefresh={() => void refreshOne(sub.id)}
                  onReveal={() => void reveal(sub)}
                  onCopy={(value) => void copy(value)}
                  onRemove={() => setRemoving(sub)}
                  onGoServers={() => onNavigate('servers')}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Card style={{ marginTop: 18 }}>
        <Field label={t('autoRefreshField')}>
          <Segmented
            value={String(settings.autoRefreshMinutes)}
            options={REFRESH_OPTIONS.map((option) => ({ value: option.value, label: t(option.key) }))}
            onChange={(value) => void saveSettings({ autoRefreshMinutes: Number(value) })}
          />
        </Field>
        <div style={{ marginTop: 14 }}>
          <Notice kind="default" icon="shield" title={t('privacyTitle')}>
            {t('privacyBody')}
          </Notice>
        </div>
      </Card>

      <Modal
        open={removing !== null}
        title={t('subRemoveTitle')}
        onClose={() => setRemoving(null)}
        actions={
          <>
            <Button variant="danger" icon="trash" onClick={() => removing && void remove(removing)}>
              {t('subRemoveOne')}
            </Button>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t('cancel')}
            </Button>
          </>
        }
      >
        {t('subRemoveConfirm')}
      </Modal>

      <Modal
        open={pwPrompt !== null}
        title={t('filePasswordTitle')}
        onClose={() => setPwPrompt(null)}
        actions={
          <>
            <Button variant="primary" icon="folder" onClick={() => void submitFilePassword()} disabled={!pwValue}>
              {t('filePasswordSubmit')}
            </Button>
            <Button variant="ghost" onClick={() => setPwPrompt(null)}>
              {t('cancel')}
            </Button>
          </>
        }
      >
        <div style={{ marginBottom: 12 }}>{t('filePasswordBody')}</div>
        {pwPrompt?.wrong ? (
          <div style={{ marginBottom: 12 }}>
            <Notice kind="danger" icon="error" title={t('filePasswordWrong')} />
          </div>
        ) : null}
        <Field label={t('filePasswordPlaceholder')}>
          <input
            className="input mono"
            dir="ltr"
            type="password"
            autoFocus
            value={pwValue}
            onChange={(event) => setPwValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitFilePassword()
            }}
          />
        </Field>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ card */

interface SubCardProps {
  sub: SubscriptionView
  revealedUrl?: string
  onRefresh: () => void
  onReveal: () => void
  onCopy: (value: string) => void
  onRemove: () => void
  onGoServers: () => void
}

function SubCard({ sub, revealedUrl, onRefresh, onReveal, onCopy, onRemove, onGoServers }: SubCardProps): React.ReactElement {
  const { t, pick } = useI18n()
  const info = sub.userinfo
  const percent = info ? subPercent(info) : null
  const remaining = info ? subRemaining(info) : null
  const days = info ? subDaysLeft(info) : null
  const tone = percent === null ? 'ok' : percent >= 90 ? 'danger' : percent >= 70 ? 'warn' : 'ok'

  return (
    <Card className="subcard">
      <div className="subcard__head">
        <div className="subcard__id">
          <span className="subcard__name" title={t('subFromPanel')}>
            {sub.name ?? hostOf(sub.maskedUrl)}
          </span>
          {sub.isFile ? (
            <span className="badge badge--accent">
              <Icon name="folder" size={11} /> {t('fileBadge')}
            </span>
          ) : sub.name ? (
            <span className="badge badge--accent">{t('subFromPanel')}</span>
          ) : null}
          {sub.fetching ? (
            <span className="badge badge--muted">
              <Icon name="refresh" size={11} /> {t('subFetching')}
            </span>
          ) : null}
        </div>
        <div className="subcard__actions">
          <Button size="sm" variant="ghost" icon="refresh" onClick={onRefresh} loading={sub.fetching} title={t('subRefreshOne')}>
            {t('subRefreshOne')}
          </Button>
          <Button size="sm" variant="ghost" icon="eye" onClick={onReveal} title={t('subRevealUrl')} />
          <Button size="sm" variant="ghost" icon="servers" onClick={onGoServers} title={t('navServers')} />
          <Button size="sm" variant="ghost" icon="trash" onClick={onRemove} title={t('subRemoveOne')} />
        </div>
      </div>

      <div className="subcard__url mono" dir="ltr">
        {revealedUrl ?? sub.maskedUrl}
        {revealedUrl ? (
          <button type="button" className="btn btn--icon btn--sm" title={t('copySocks')} onClick={() => onCopy(revealedUrl)}>
            <Icon name="copy" size={13} />
          </button>
        ) : null}
      </div>

      {sub.lastError ? (
        <div style={{ marginTop: 10 }}>
          <Notice kind="danger" icon="error" title={t('subErrorTitle')}>
            {pick(sub.lastError)}
          </Notice>
        </div>
      ) : null}

      <div className="usage" style={{ marginTop: 14 }}>
        <div className="usage__head">
          <span className="card__title">
            <Icon name="gauge" size={14} /> {t('usageTitle')}
          </span>
          {percent !== null ? <span className="badge badge--muted">{t('usagePercent', { p: fa(percent) })}</span> : null}
        </div>
        {info ? (
          <>
            <div className="usage__bar" role="progressbar" aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <span className="usage__fill" data-tone={tone} style={{ width: `${percent ?? 4}%` }} />
            </div>
            <div className="usage__grid">
              <div className="usage__cell">
                <span className="usage__label">{t('usageUsed')}</span>
                <span className="usage__value">{formatBytes(subUsed(info))}</span>
              </div>
              <div className="usage__cell">
                <span className="usage__label">{t('usageRemaining')}</span>
                <span className="usage__value">{remaining === null ? t('usageUnlimited') : formatBytes(remaining)}</span>
              </div>
              <div className="usage__cell">
                <span className="usage__label">{t('usageTotal')}</span>
                <span className="usage__value">{info.total ? formatBytes(info.total) : t('usageUnlimited')}</span>
              </div>
              <div className="usage__cell">
                <span className="usage__label">{t('usageExpire')}</span>
                <span className="usage__value" data-tone={days !== null && days < 0 ? 'danger' : undefined}>
                  {info.expire
                    ? days !== null && days < 0
                      ? t('usageExpired')
                      : `${faDate(info.expire * 1000)}${days !== null ? ` · ${t('usageDaysLeft', { n: fa(days) })}` : ''}`
                    : t('usageNoExpiry')}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="field__hint">{t('usageNoQuota')}</p>
        )}
      </div>

      <div className="subcard__meta">
        <span>{t('subConfigs', { total: fa(sub.totalConfigs), supported: fa(sub.supportedConfigs) })}</span>
        <span>{sub.updatedAt ? t('subUpdated', { when: faRelative(sub.updatedAt) }) : t('subNeverUpdated')}</span>
      </div>
    </Card>
  )
}
