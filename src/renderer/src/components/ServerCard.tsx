/**
 * One row in the server list.
 *
 * Shows only masked data by default; the eye icon pulls the real value from the
 * main process on demand (and that request is itself logged, without content).
 */
import React, { useState } from 'react'
import { motion } from 'motion/react'

import { Button, Reveal } from './ui'
import { latencyClass, fa } from '../lib/format'
import { NETWORK_LABEL, PROTOCOL_LABEL, SECURITY_LABEL } from '../lib/labels'
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
  const disabled = !server.supported

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

      <span style={{ minWidth: 0 }}>
        <span className="server__name">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</span>
          <span className={`badge ${server.security === 'reality' ? 'badge--accent' : ''}`}>
            {PROTOCOL_LABEL[server.protocol]}
          </span>
          {server.security !== 'none' ? (
            <span className="badge">{SECURITY_LABEL[server.security]}</span>
          ) : null}
          <span className="badge">{NETWORK_LABEL[server.network]}</span>
          {server.flow ? <span className="badge badge--warning">{server.flow}</span> : null}
          {server.allowInsecure ? <span className="badge badge--danger">Insecure</span> : null}
          {active ? <span className="badge badge--success">در حال استفاده</span> : null}
        </span>

        <span className="server__meta">
          <span className="mono">
            <Reveal
              masked={server.addressMasked}
              revealed={revealed?.address}
              onReveal={() => void reveal()}
            />
            :{fa(server.port)}
          </span>
          <span className="mono">
            <Reveal
              masked={server.credentialMasked}
              revealed={revealed?.credential}
              onReveal={() => void reveal()}
            />
          </span>
          {server.unsupportedReason ? <span style={{ color: 'var(--danger)' }}>{server.unsupportedReason}</span> : null}
        </span>
      </span>

      <span className="server__actions" onClick={(event) => event.stopPropagation()}>
        <span className={`latency ${latencyClass(server.latencyMs)}`}>
          {testing ? '…' : server.latencyMs === null ? 'تست نشده' : `${fa(server.latencyMs)} ms`}
        </span>
        <Button size="sm" variant="ghost" icon="gauge" onClick={onTest} disabled={disabled || testing} title="تست تأخیر" />
        <Button size="sm" variant="ghost" icon="copy" onClick={onCopy} disabled={disabled} title="کپی لینک" />
        <Button size="sm" variant="ghost" icon="trash" onClick={onRemove} title="حذف" />
        <Button size="sm" variant="primary" icon="bolt" onClick={onConnect} disabled={disabled}>
          اتصال
        </Button>
      </span>
    </motion.div>
  )
}
