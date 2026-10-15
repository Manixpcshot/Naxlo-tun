/**
 * Toast stack — bilingual payloads are rendered in the active language.
 */
import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon, type IconName } from './Icon'
import { useStore } from '../lib/store'
import { useI18n } from '../lib/i18n'

const ICON: Record<string, IconName> = {
  success: 'check',
  error: 'error',
  warning: 'alert',
  info: 'info'
}

export function Toasts(): React.ReactElement {
  const { toasts, dismissToast } = useStore()
  const { pick } = useI18n()

  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            className={`toast toast--${toast.kind}`}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={() => dismissToast(toast.id)}
            role="status"
          >
            <span className="toast__icon">
              <Icon name={ICON[toast.kind] ?? 'info'} size={17} />
            </span>
            <span className="toast__text">
              <span className="toast__title">{pick(toast.title)}</span>
              {toast.message ? <span className="toast__message">{pick(toast.message)}</span> : null}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
