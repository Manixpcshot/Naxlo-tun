/**
 * One row in the server list, with country flags parsed out of the remark
 * (subscriptions commonly embed 🇩🇪-style emoji) and masked secrets.
 */
import React, { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Button, Reveal } from './ui'
import { Flag } from './Flag'
import { latencyClass, fa, extractFlagCodes, stripFlags } from '../lib/format'
import { useI18n } from '../lib/i18n'
import type { ServerView } from '@shared/bridge'

interface Props {
  server: ServerView
  selected: boolean
  active: boolean
  testing: boolean
  onSelect: () => void
  onConnect: () => void
  onTest: () => void
  onCopy: () => void
  onRemove: () => void
  onReveal: () => Promise<ServerView | undefined>
}

export function ServerCard({
  server,
  selected,
  active,
  testing,
  onSelect,
  onConnect,
  onTest,
  onCopy,
  onRemove,
  onReveal
}: Props): React.ReactElement {
  const [revealed, setRevealed] = useState<ServerView | null>(null)
  const { t, pick } = useI18n()
  const disabled = !server.supported

  const flags = useMemo(() => extractFlagCodes(server.name), [server.name])
  const cleanName = useMemo(() => stripFlags(server.name) || server.name, [server.name])
  const flagCode = flags[0] ?? null

  const reveal = async (): Promise<void> => {
    if (revealed) return
    const full = await onReveal()
    if (full) setRevealed(full)
  }

  return (
    <motion.div
      layout
      className={[
        'server',
        selected ? 'server--selected' : '',
        active ? 'server--active' : '',
        disabled ? 'server--disabled' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => !disabled && onSelect()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      role="option"
      aria-selected={selected}
    >
      <span className="server__radio" aria-hidden="true">
        {selected ? (
          <motion.span
            className="server__radio-dot"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
          />
        ) : null}
      </span>

      <span className="server__body">
        <span className="server__name">
          {flagCode ? <Flag code={flagCode} /> : null}
          <span className="server__title">{cleanName}</span>
          <span className={`badge ${server.security === 'reality' ? 'badge--accent' : ''}`}>{server.protocol.toUpperCase()}</span>
          {server.security !== 'none' ? <span className="badge">{server.security.toUpperCase()}</span> : null}
          <span className="badge badge--muted">{server.network.toUpperCase()}</span>
          {server.flow ? <span className="badge badge--warning">vision</span> : null}
          {server.allowInsecure ? <span className="badge badge--danger">{t('insecure')}</span> : null}
          {active ? <span className="badge badge--success">{t('inUse')}</span> : null}
        </span>

        <span className="server__meta">
          <span className="mono">
            <Reveal masked={server.addressMasked} revealed={revealed?.address} onReveal={() => void reveal()} />
            :{server.port}
          </span>
          <span className="mono">
            <Reveal masked={server.credentialMasked} revealed={revealed?.credential} onReveal={() => void reveal()} />
          </span>
          {server.unsupportedReason ? (
            <span className="server__reason">{pick(server.unsupportedReason)}</span>
          ) : null}
        </span>
      </span>

      <span className="server__actions" onClick={(event) => event.stopPropagation()}>
        <span className={`latency ${latencyClass(server.latencyMs)}`}>
          {testing ? '…' : server.latencyMs === null ? t('untested') : `${fa(server.latencyMs)} ms`}
        </span>
        <Button size="sm" variant="ghost" icon="gauge" onClick={onTest} disabled={disabled || testing} title={t('testLatency')} />
        <Button size="sm" variant="ghost" icon="copy" onClick={onCopy} disabled={disabled} title={t('copyLink')} />
        <Button size="sm" variant="ghost" icon="trash" onClick={onRemove} title={t('remove')} />
        <Button size="sm" variant="primary" icon="bolt" onClick={onConnect} disabled={disabled}>
          {t('connect')}
        </Button>
      </span>
    </motion.div>
  )
}
