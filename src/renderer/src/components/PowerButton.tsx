/**
 * The centrepiece: an animated power control.
 *
 * idle      → breathing dashed orbit, muted disc
 * busy      → arc sweeps around the disc, halo pulses
 * connected → green halo + soft glow, slow orbit
 * error     → red rim, shake-free but clearly flagged
 */
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './Icon'
import type { ConnectionState } from '@shared/bridge'

interface Props {
  connection: ConnectionState
  onClick: () => void
  disabled?: boolean
  label: string
}

export function PowerButton({ connection, onClick, disabled, label }: Props): React.ReactElement {
  const [ripples, setRipples] = useState<number[]>([])
  const busy = connection === 'preparing' || connection === 'starting' || connection === 'stopping'
  const connected = connection === 'connected'
  const error = connection === 'error' || connection === 'core-missing'

  const fireRipple = (): void => {
    if (disabled) return
    const id = Date.now()
    setRipples((prev) => [...prev, id])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r !== id)), 900)
    onClick()
  }

  const rimColor = connected ? 'var(--success)' : error ? 'var(--danger)' : 'var(--accent)'

  return (
    <motion.button
      type="button"
      className={`power ${connected ? 'power--on' : ''} ${busy ? 'power--busy' : ''} ${error ? 'power--error' : ''}`}
      onClick={fireRipple}
      disabled={disabled}
      aria-label={label}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
    >
      <span className="power__halo" aria-hidden="true" />

      <span className="power__ring" aria-hidden="true">
        <svg viewBox="0 0 190 190">
          <circle
            cx="95"
            cy="95"
            r="86"
            fill="none"
            stroke={rimColor}
            strokeOpacity={connected ? 0.4 : 0.22}
            strokeWidth="1"
          />
          <circle
            className="dash-ring"
            cx="95"
            cy="95"
            r="78"
            stroke={rimColor}
            strokeOpacity={busy ? 0.85 : 0.35}
          />
          {busy ? (
            <motion.circle
              cx="95"
              cy="95"
              r="70"
              fill="none"
              stroke={rimColor}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="90 350"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: '95px 95px' }}
            />
          ) : null}
          {connected ? (
            <motion.circle
              cx="95"
              cy="95"
              r="70"
              fill="none"
              stroke={rimColor}
              strokeWidth="1.6"
              strokeOpacity="0.5"
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: [0.94, 1.06], opacity: [0.45, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeOut' }}
              style={{ transformOrigin: '95px 95px' }}
            />
          ) : null}
        </svg>
      </span>

      <AnimatePresence>
        {ripples.map((id) => (
          <motion.span
            key={id}
            className="power__ripple"
            initial={{ opacity: 0.55, scale: 0.72 }}
            animate={{ opacity: 0, scale: 1.28 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ borderColor: rimColor }}
          />
        ))}
      </AnimatePresence>

      <span className="power__disc">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={connected ? 'on' : busy ? 'busy' : 'off'}
            initial={{ opacity: 0, scale: 0.7, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            style={{
              display: 'grid',
              placeItems: 'center',
              color: connected ? 'var(--success)' : error ? 'var(--danger)' : 'var(--text)'
            }}
          >
            <Icon
              name={connected ? 'disconnect' : busy ? 'spinner' : 'power'}
              size={46}
              strokeWidth={1.6}
              className={busy ? 'spin-slow' : undefined}
            />
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="power__label">{label}</span>
    </motion.button>
  )
}
