/**
 * Frameless titlebar: brand, live status hint and window controls.
 */
import React from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import { Logo } from './Logo'
import { useStore } from '../lib/store'
import { CONNECTION_LABEL } from '../lib/labels'

export function Titlebar(): React.ReactElement {
  const { state } = useStore()
  const label = CONNECTION_LABEL[state.connection]

  const call = (fn: () => Promise<unknown>): void => {
    void fn().catch(() => undefined)
  }

  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <span className="titlebar__logo">
          <Logo size={22} animated />
        </span>
        <span>naxlo</span>
      </div>

      <div className="titlebar__spacer" />

      <div className="titlebar__hint">
        <motion.span
          key={label.text}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
        >
          {label.text}
        </motion.span>
        {state.connection === 'connected' ? (
          <span className="eq" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>

      <div className="titlebar__controls">
        <button className="winbtn" title="کمینه کردن" onClick={() => call(() => window.naxlo.window.minimize())}>
          <Icon name="minimize" size={15} />
        </button>
        <button className="winbtn" title="بزرگ‌نمایی" onClick={() => call(() => window.naxlo.window.toggleMaximize())}>
          <Icon name="maximize" size={15} />
        </button>
        <button
          className="winbtn winbtn--close"
          title="بستن (برنامه در پس‌زمینه می‌ماند)"
          onClick={() => call(() => window.naxlo.window.close())}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </header>
  )
}
