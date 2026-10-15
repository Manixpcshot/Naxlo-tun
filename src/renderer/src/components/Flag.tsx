/**
 * Country flag chip (flag-icons, 4x3 SVGs bundled at build time).
 */
import React from 'react'

interface Props {
  code?: string | null
  large?: boolean
  title?: string
}

export function Flag({ code, large = false, title }: Props): React.ReactElement | null {
  const clean = (code ?? '').trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(clean)) return null
  return (
    <span
      className={`flag ${large ? 'flag--lg' : ''}`}
      data-flag={clean}
      title={title ?? clean.toUpperCase()}
      aria-label={title ?? clean.toUpperCase()}
      role="img"
    />
  )
}
