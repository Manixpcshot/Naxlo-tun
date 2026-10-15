/**
 * Toast stack — animated, auto-dismissing, dismissible by click.
 */
import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon, type IconName } from './Icon'
import { useStore } from '../lib/store'

const ICON: Record<string, IconName> = {
  success: 'check',
  error: 'error',
  warning: 'alert',
  info: 'info'
}

export function Toasts(): React.ReactElement {
  const { toasts, dismissToast } = useStore()

  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toast toast--${toast.kind}`}
            layout
            initial={{ opacity: 0, x: -26, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -18, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={() => dismissToast(toast.id)}
            role="status"
          >
            <span className="toast__icon">
              <Icon name={ICON[toast.kind] ?? 'info'} size={17} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="toast__title" style={{ color: 'var(--text)' }}>
                {toast.title}
              </span>
              {toast.message ? <span className="toast__message">{toast.message}</span> : null}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
