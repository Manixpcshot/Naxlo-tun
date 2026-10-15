/**
 * Naxlo mark — an abstract "N" formed by two nodes and a tunnel between them.
 * Drawn as SVG so it stays crisp at 16 px (tray) and 512 px (installer).
 */
import React from 'react'

interface LogoProps {
  size?: number
  animated?: boolean
  className?: string
}

export function Logo({ size = 28, animated = false, className = '' }: LogoProps): React.ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="naxlo-stroke" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-strong)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <radialGradient id="naxlo-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent-strong)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.15" />
        </radialGradient>
      </defs>

      <rect x="2.5" y="2.5" width="59" height="59" rx="17" fill="rgba(255,255,255,0.035)" stroke="var(--border-strong)" />

      {/* orbit */}
      <circle
        cx="32"
        cy="32"
        r="21"
        stroke="var(--accent)"
        strokeOpacity="0.28"
        strokeWidth="1.4"
        strokeDasharray="4 7"
        className={animated ? 'logo-orbit' : undefined}
      />

      {/* the N */}
      <path
        d="M21 44V20l22 24V20"
        stroke="url(#naxlo-stroke)"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* nodes */}
      <circle cx="21" cy="20" r="4.1" fill="url(#naxlo-core)" />
      <circle cx="43" cy="44" r="4.1" fill="url(#naxlo-core)" />
      <circle cx="21" cy="20" r="1.5" fill="#05060a" />
      <circle cx="43" cy="44" r="1.5" fill="#05060a" />
    </svg>
  )
}
