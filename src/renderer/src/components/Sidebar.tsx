/**
 * Right-hand navigation rail (RTL) with a sliding indicator.
 */
import React from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import { Logo } from './Logo'
import { useStore } from '../lib/store'
import { CONNECTION_LABEL } from '../lib/labels'
import { fa } from '../lib/format'

export type PageId = 'home' | 'servers' | 'subscription' | 'settings' | 'logs' | 'about'

export const PAGES: Array<{ id: PageId; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { id: 'home', label: 'اتصال', icon: 'bolt' },
  { id: 'servers', label: 'سرورها', icon: 'servers' },
  { id: 'subscription', label: 'اشتراک', icon: 'subscription' },
  { id: 'settings', label: 'تنظیمات', icon: 'settings' },
  { id: 'logs', label: 'گزارش‌ها', icon: 'logs' },
  { id: 'about', label: 'درباره', icon: 'info' }
]

interface Props {
  page: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ page, onNavigate }: Props): React.ReactElement {
  const { state } = useStore()
  const label = CONNECTION_LABEL[state.connection]

  return (
    <nav className="sidebar" aria-label="ناوبری اصلی">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 12px' }}>
        <Logo size={30} animated />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: 15, letterSpacing: '0.01em' }}>naxlo</strong>
          <span style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>پروکسی محلی VLESS</span>
        </div>
      </div>

      <span className="sidebar__label">منو</span>

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
            <span>{item.label}</span>
            {item.id === 'servers' && state.subscription.totalConfigs > 0 ? (
              <span className="badge" style={{ marginInlineStart: 'auto' }}>
                {fa(state.subscription.totalConfigs)}
              </span>
            ) : null}
          </button>
        )
      })}

      <div className="sidebar__footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={`pill__dot`}
            style={{
              background:
                label.tone === 'connected'
                  ? 'var(--success)'
                  : label.tone === 'error'
                    ? 'var(--danger)'
                    : label.tone === 'busy'
                      ? 'var(--warning)'
                      : 'var(--text-mute)'
            }}
          />
          <span>{label.text}</span>
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>
          SOCKS5 {state.socksPort} • HTTP {state.httpPort}
        </span>
      </div>
    </nav>
  )
}
