/**
 * Tiny latency sparkline with an animated draw-in.
 */
import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

interface Props {
  values: Array<number | null>
  width?: number
  height?: number
}

export function Sparkline({ values, width = 148, height = 34 }: Props): React.ReactElement {
  const [path, setPath] = useState('')
  const [area, setArea] = useState('')
  const idRef = useRef(`spark-${Math.random().toString(36).slice(2, 8)}`)

  useEffect(() => {
    const clean = values.filter((v): v is number => v !== null && v > 0).slice(-40)
    if (clean.length < 2) {
      setPath('')
      setArea('')
      return
    }
    const max = Math.max(...clean) * 1.15
    const min = Math.min(...clean) * 0.85
    const span = Math.max(1, max - min)
    const step = width / (clean.length - 1)
    const points = clean.map((value, index) => {
      const x = index * step
      const y = height - ((value - min) / span) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    setPath(`M${points.join(' L')}`)
    setArea(`M0,${height} L${points.join(' L')} L${width},${height} Z`)
  }, [values, width, height])

  if (!path) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 5" />
      </svg>
    )
  }

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${idRef.current}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#${idRef.current}-fill)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </svg>
  )
}
