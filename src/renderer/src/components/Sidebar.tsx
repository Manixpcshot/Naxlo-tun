/**
 * Navigation rail with a sliding indicator (right side in RTL, left in LTR).
 */
import React from 'react'
import { motion } from 'motion/react'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'
import { fa } from '../lib/format'

export type PageId = 'home' | 'servers' | 'subscription' | 'settings' | 'logs' | 'about'

export const PAGES: Array<{ id: PageId; label: MsgKey; icon: IconName }> = [
  { id: 'home', label: 'navHome', icon: 'bolt' },
  { id: 'servers', label: 'navServers', icon: 'servers' },
  { id: 'subscription', label: 'navSubscription', icon: 'subscription' },
  { id: 'settings', label: 'navSettings', icon: 'settings' },
  { id: 'logs', label: 'navLogs', icon: 'logs' },
  { id: 'about', label: 'navAbout', icon: 'info' }
]

interface Props {
  page: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ page, onNavigate }: Props): React.ReactElement {
  const { state } = useStore()
  const { t } = useI18n()

  const statusKey =
    state.connection === 'connected'
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

  const tone =
    state.connection === 'connected'
      ? 'var(--success)'
      : state.connection === 'error' || state.connection === 'core-missing'
        ? 'var(--danger)'
        : state.connection === 'idle'
          ? 'var(--text-mute)'
          : 'var(--warning)'

  return (
    <nav className="sidebar" aria-label="main navigation">
      <div className="sidebar__brand">
        <Logo size={30} animated />
        <div className="sidebar__brand-text">
          <strong>naxlo</strong>
          <span>{t('appTagline')}</span>
        </div>
      </div>

      <span className="sidebar__label">{t('menu')}</span>

      {PAGES.map((item) => {
        const active = item.id === page
        return (
          <button
            key={item.id}
            type="button"
            className={`navitem ${active ? 'navitem--active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
          >
            {active ? (
              <motion.span
                className="navitem__pill"
                layoutId="nav-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
              />
            ) : null}
            <span className="navitem__icon">
              <Icon name={item.icon} size={17} />
            </span>
            <span>{t(item.label)}</span>
            {item.id === 'servers' && state.subscription.totalConfigs > 0 ? (
              <span className="badge" style={{ marginInlineStart: 'auto' }}>
                {fa(state.subscription.totalConfigs)}
              </span>
            ) : null}
          </button>
        )
      })}

      <div className="sidebar__footer">
        <div className="sidebar__status">
          <span className="sidebar__dot" style={{ background: tone }} />
          <span>{t(statusKey)}</span>
        </div>
        <span className="mono sidebar__ports">
          SOCKS5 {state.socksPort} • HTTP {state.httpPort}
        </span>
      </div>
    </nav>
  )
}
