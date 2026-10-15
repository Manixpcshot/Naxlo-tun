/**
 * Small UI primitives shared by every page.
 */
import React, { useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Icon, Spinner, type IconName } from './Icon'

/* ---------------------------------------------------------------- Button */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'default'
  size?: 'sm' | 'md'
  icon?: IconName
  loading?: boolean
  children?: React.ReactNode
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps): React.ReactElement {
  const classes = [
    'btn',
    variant === 'primary' ? 'btn--primary' : '',
    variant === 'ghost' ? 'btn--ghost' : '',
    variant === 'danger' ? 'btn--danger' : '',
    size === 'sm' ? 'btn--sm' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={classes} disabled={disabled || loading} {...rest}>
      <span className="btn__shine" aria-hidden="true" />
      {loading ? <Spinner size={size === 'sm' ? 13 : 15} /> : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  )
}

/* ----------------------------------------------------------------- Card */

export function Card({
  children,
  className = '',
  hover = false,
  style
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
  style?: React.CSSProperties
}): React.ReactElement {
  return (
    <div className={`card ${hover ? 'card--hover' : ''} ${className}`} style={style}>
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- Toggle */

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  description?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, title, description, disabled }: ToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
    >
      <span className="toggle__text">
        <span className="toggle__title">{title}</span>
        {description ? <span className="toggle__desc">{description}</span> : null}
      </span>
      <span className={`switch ${checked ? 'switch--on' : ''}`}>
        <motion.span
          className="switch__knob"
          animate={{ x: checked ? -18 : 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          style={{ transform: 'none' }}
        />
      </span>
    </button>
  )
}

/* ---------------------------------------------------------------- Field */

interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
  htmlFor?: string
}

export function Field({ label, hint, children, htmlFor }: FieldProps): React.ReactElement {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}

/* ----------------------------------------------------------- Segmented */

interface SegmentedProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled
}: SegmentedProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const active = container.querySelector<HTMLElement>(`[data-value="${value}"]`)
    if (!active) return
    const rect = active.getBoundingClientRect()
    const parentRect = container.getBoundingClientRect()
    setThumb({ left: rect.left - parentRect.left, width: rect.width })
  }, [value, options])

  return (
    <div className="segmented" ref={containerRef} role="tablist">
      <motion.span
        className="segmented__thumb"
        initial={false}
        animate={{ x: thumb.left, width: thumb.width }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        style={{ width: thumb.width }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          data-value={option.value}
          aria-selected={option.value === value}
          className={`segmented__item ${option.value === value ? 'segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- Progress */

export function Progress({
  value,
  indeterminate = false,
  label
}: {
  value: number | null
  indeterminate?: boolean
  label?: string
}): React.ReactElement {
  const percent = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className={`progress ${indeterminate ? 'progress--indeterminate' : ''}`}>
        <div className="progress__bar" style={{ width: `${percent}%` }} />
      </div>
      {label ? <span className="field__hint">{label}</span> : null}
    </div>
  )
}

/* --------------------------------------------------------------- Notice */

export function Notice({
  kind = 'default',
  icon = 'info',
  children,
  title
}: {
  kind?: 'default' | 'accent' | 'warning' | 'danger'
  icon?: IconName
  children?: React.ReactNode
  title?: string
}): React.ReactElement {
  return (
    <div className={`notice ${kind === 'default' ? '' : `notice--${kind}`}`}>
      <span className="notice__icon">
        <Icon name={icon} size={16} />
      </span>
      <div>
        {title ? <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong> : null}
        {children}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Modal */

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children?: React.ReactNode
  actions?: React.ReactNode
}

export function Modal({ open, title, onClose, children, actions }: ModalProps): React.ReactElement {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="modal__title">{title}</h3>
            {children ? <div className="modal__body">{children}</div> : null}
            {actions ? <div className="modal__actions">{actions}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/* --------------------------------------------------------------- Reveal */

export function Reveal({
  masked,
  onReveal,
  revealed,
  mono = true
}: {
  masked: string
  onReveal: () => void
  revealed?: string
  mono?: boolean
}): React.ReactElement {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const shown = visible && revealed ? revealed : masked
  return (
    <span
      className={`reveal ${mono ? 'mono' : ''}`}
      role="button"
      tabIndex={0}
      id={id}
      title={visible ? 'پنهان کردن' : 'نمایش مقدار واقعی'}
      onClick={() => {
        setVisible((v) => !v)
        if (!visible && !revealed) onReveal()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setVisible((v) => !v)
          if (!visible && !revealed) onReveal()
        }
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={visible ? 'real' : 'masked'}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.2 }}
          style={{ display: 'inline-block' }}
        >
          {shown}
        </motion.span>
      </AnimatePresence>
      <span className="reveal__eye">
        <Icon name={visible ? 'eyeOff' : 'eye'} size={13} />
      </span>
    </span>
  )
}

/* ----------------------------------------------------------- PageHeader */

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="pagehead">
      <div>
        <motion.h1
          className="pagehead__title"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {title}
        </motion.h1>
        {description ? (
          <motion.p
            className="pagehead__desc"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.05 }}
          >
            {description}
          </motion.p>
        ) : null}
      </div>
      {actions ? <div className="pagehead__actions">{actions}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------- Skeleton */

export function SkeletonRow({ width = '100%', height = 14 }: { width?: string | number; height?: number }): React.ReactElement {
  return <div className="skeleton" style={{ width, height }} />
}
