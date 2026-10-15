/**
 * Icon set — hand-drawn 24×24 stroke glyphs (currentColor, 1.7 stroke).
 */
import React from 'react'

export type IconName =
  | 'power'
  | 'disconnect'
  | 'servers'
  | 'subscription'
  | 'settings'
  | 'logs'
  | 'info'
  | 'shield'
  | 'globe'
  | 'activity'
  | 'search'
  | 'refresh'
  | 'close'
  | 'minimize'
  | 'maximize'
  | 'eye'
  | 'eyeOff'
  | 'copy'
  | 'trash'
  | 'check'
  | 'alert'
  | 'error'
  | 'chevron'
  | 'download'
  | 'clock'
  | 'gauge'
  | 'lock'
  | 'external'
  | 'folder'
  | 'cpu'
  | 'bolt'
  | 'link'
  | 'play'
  | 'pause'
  | 'plus'
  | 'filter'
  | 'pin'
  | 'spinner'

interface Props {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

const PATHS: Record<IconName, React.ReactNode> = {
  power: (
    <>
      <path d="M12 3.5v8" />
      <path d="M7.2 6.6a7 7 0 1 0 9.6 0" />
    </>
  ),
  disconnect: (
    <>
      <path d="M9 7 5.5 10.5a3.5 3.5 0 0 0 5 5L14 12" />
      <path d="m15 17 3.5-3.5a3.5 3.5 0 0 0-5-5L10 12" />
      <path d="m4 4 16 16" />
    </>
  ),
  servers: (
    <>
      <rect x="3.5" y="4" width="17" height="6" rx="2" />
      <rect x="3.5" y="14" width="17" height="6" rx="2" />
      <path d="M7 7h.01M7 17h.01" />
    </>
  ),
  subscription: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H16a2.5 2.5 0 0 1 0 5H8" />
      <path d="M20 16.5A2.5 2.5 0 0 1 17.5 19H8a2.5 2.5 0 0 1 0-5h8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  logs: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="m7.5 9.5 2.5 2.5-2.5 2.5M12.5 15h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5.5 6v5.5c0 4 2.8 7.3 6.5 9 3.7-1.7 6.5-5 6.5-9V6z" />
      <path d="m9.3 12.2 1.9 1.9 3.6-3.8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5S14.4 18.1 12 20.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5Z" />
    </>
  ),
  activity: <path d="M3.5 12.5h3.8L10 6.5l3.6 11 2.4-5h4.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5A8 8 0 0 0 6.3 6.6L4 9" />
      <path d="M4 4.5V9h4.5" />
      <path d="M4 12.5A8 8 0 0 0 17.7 17.4L20 15" />
      <path d="M20 19.5V15h-4.5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  minimize: <path d="M5 12.5h14" />,
  maximize: (
    <>
      <path d="M8.5 4.5h11v11" />
      <path d="M15.5 19.5h-11v-11" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6.4 6.2 12 6.2 21.2 12 21.2 12 17.6 17.8 12 17.8 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.6 6.6A8.9 8.9 0 0 1 12 6.2c5.6 0 9.2 5.8 9.2 5.8a17 17 0 0 1-2.7 3.4" />
      <path d="M6.3 8.1A16.7 16.7 0 0 0 2.8 12S6.4 17.8 12 17.8a9 9 0 0 0 3.4-.65" />
      <path d="m10 10a2.8 2.8 0 0 0 4 4" />
      <path d="m4 4 16 16" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M15 6.2V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15h.7" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.5 7 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.8h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 13 3.5-3.5" />
      <circle cx="12" cy="17" r="1.4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.8" y="10.5" width="14.4" height="9.5" rx="2.2" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19 5 11 13" />
      <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </>
  ),
  folder: <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3.7l1.8 2.2h7.5A1.5 1.5 0 0 1 20 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />,
  cpu: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <path d="M10 3.5v3M14 3.5v3M10 17.5v3M14 17.5v3M3.5 10h3M3.5 14h3M17.5 10h3M17.5 14h3" />
    </>
  ),
  bolt: <path d="M13.5 3 5.8 13.4h5.2L10.2 21l7.9-10.6h-5.3z" />,
  link: (
    <>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.3 1.3" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.3-1.3" />
    </>
  ),
  play: <path d="M8 5.5 18.5 12 8 18.5z" />,
  pause: (
    <>
      <path d="M9.5 5v14M14.5 5v14" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M4 6.5h16l-6.2 7.3v5.2l-3.6 1.8v-7z" />,
  pin: (
    <>
      <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </>
  ),
  spinner: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
    </>
  )
}

export function Icon({ name, size = 18, className, strokeWidth = 1.7 }: Props): React.ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }): React.ReactElement {
  return <span className={`spinner ${className}`} style={{ width: size, height: size }} />
}
