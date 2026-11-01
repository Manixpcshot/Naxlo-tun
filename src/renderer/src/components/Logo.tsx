/**
 * Naxlo mark — the "tunnel": a geometric N drawn as a light beam between two
 * nodes, centred on a concentric orbit ring. Mirrors `build/icon-source.svg`
 * so the window chrome, the tray and the installer share one identity.
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
        <linearGradient id="naxlo-stroke" x1="21" y1="19" x2="43" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-strong)" />
          <stop offset="55%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-dim)" />
        </linearGradient>
        <radialGradient id="naxlo-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent-strong)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="2.5" y="2.5" width="59" height="59" rx="17" fill="rgba(255,255,255,0.035)" stroke="var(--border-strong)" />

      {/* orbit — always perfectly concentric with the tile */}
      <circle
        cx="32"
        cy="32"
        r="19"
        stroke="var(--accent)"
        strokeOpacity="0.22"
        strokeWidth="1.3"
        strokeDasharray="3 6"
        className={animated ? 'logo-orbit' : undefined}
      />

      {/* halo behind the beam */}
      <path
        d="M22 44V20l20 24V20"
        stroke="var(--accent)"
        strokeOpacity="0.3"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* the N */}
      <path
        d="M22 44V20l20 24V20"
        stroke="url(#naxlo-stroke)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* light entering / leaving the tunnel */}
      <circle cx="22" cy="20" r="5" fill="url(#naxlo-core)" />
      <circle cx="42" cy="44" r="5" fill="url(#naxlo-core)" />
      <circle cx="22" cy="20" r="1.8" fill="#f2feff" />
      <circle cx="42" cy="44" r="1.8" fill="#f2feff" />
    </svg>
  )
}
