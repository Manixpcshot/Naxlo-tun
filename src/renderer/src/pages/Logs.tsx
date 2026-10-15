/**
 * Logs — the sanitised ring buffer produced by the main process.
 *
 * Everything here has already passed through the redactor: subscription URLs,
 * UUIDs, REALITY keys and server addresses are replaced before storage, so the
 * log panel is safe to read, copy and share when reporting a bug.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Button, Notice, PageHeader, Segmented } from '../components/ui'
import { useStore } from '../lib/store'
import { faClock } from '../lib/format'
import type { LogLevel } from '@shared/bridge'

const LEVELS: Array<{ value: LogLevel | 'all'; label: string }> = [
  { value: 'all', label: 'همه' },
  { value: 'core', label: 'خروجی هسته' },
  { value: 'info', label: 'اطلاع' },
  { value: 'warn', label: 'هشدار' },
  { value: 'error', label: 'خطا' }
]

export function Logs(): React.ReactElement {
  const { logs, clearLogs, pushToast } = useStore()
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => (level === 'all' ? logs : logs.filter((entry) => entry.level === level)),
    [logs, level]
  )

  useEffect(() => {
    if (!autoScroll) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [filtered.length, autoScroll])

  return (
    <div>
      <PageHeader
        title="گزارش‌ها"
        description="رویدادهای برنامه و خروجی هستهٔ Xray — همهٔ مقادیر حساس پیش از ذخیره پوشانده شده‌اند."
        actions={
          <>
            <Button
              icon="copy"
              onClick={() => {
                const text = filtered.map((l) => `${new Date(l.at).toISOString()} [${l.level}] (${l.scope}) ${l.message}`).join('\n')
                void navigator.clipboard
                  ?.writeText(text)
                  .then(() => pushToast({ kind: 'success', title: 'گزارش‌ها کپی شد' }))
                  .catch(() => pushToast({ kind: 'error', title: 'کپی ناموفق بود' }))
              }}
            >
              کپی همه
            </Button>
            <Button variant="danger" icon="trash" onClick={() => void clearLogs()}>
              پاک کردن
            </Button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <Segmented
          value={level}
          options={LEVELS}
          onChange={(value) => setLevel(value as LogLevel | 'all')}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-dim)' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
          />
          پیمایش خودکار
        </label>
      </div>

      <Notice kind="accent" icon="shield">
        هیچ لینک اشتراک، کلید، شناسهٔ کاربری یا آدرس سروری در این گزارش‌ها نوشته نمی‌شود؛ مقادیر حساس با
        <span className="mono"> [redacted] </span>
        جایگزین می‌شوند.
      </Notice>

      <div className="loglist" ref={listRef} style={{ marginTop: 14 }}>
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: 'var(--text-mute)', textAlign: 'center', padding: '28px 0' }}
          >
            <Icon name="logs" size={22} />
            <div style={{ marginTop: 8 }}>گزارشی برای نمایش نیست</div>
          </motion.div>
        ) : (
          filtered.slice(-400).map((entry) => (
            <div key={entry.id} className={`logline logline--${entry.level}`}>
              <span className="logline__time">{faClock(entry.at)}</span>
              <span className="logline__scope">{entry.scope}</span>
              <span>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
