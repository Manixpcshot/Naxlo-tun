/**
 * Logs — sanitised ring buffer, bilingual chrome.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Button, Notice, PageHeader, Segmented } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'
import { faClock } from '../lib/format'
import type { LogLevel } from '@shared/bridge'

const LEVELS: Array<{ value: LogLevel | 'all'; key: MsgKey }> = [
  { value: 'all', key: 'levelAll' },
  { value: 'core', key: 'levelCore' },
  { value: 'info', key: 'levelInfo' },
  { value: 'warn', key: 'levelWarn' },
  { value: 'error', key: 'levelError' }
]

export function Logs(): React.ReactElement {
  const { logs, clearLogs, pushToast } = useStore()
  const { t, dir } = useI18n()
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => (level === 'all' ? logs : logs.filter((entry) => entry.level === level)), [logs, level])

  useEffect(() => {
    if (!autoScroll) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [filtered.length, autoScroll])

  return (
    <div>
      <PageHeader
        title={t('logsTitle')}
        description={t('logsDesc')}
        actions={
          <>
            <Button
              icon="copy"
              onClick={() => {
                const text = filtered
                  .map((entry) => `${new Date(entry.at).toISOString()} [${entry.level}] (${entry.scope}) ${entry.message}`)
                  .join('\n')
                void navigator.clipboard
                  ?.writeText(text)
                  .then(() => pushToast({ kind: 'success', title: t('logsCopied') }))
                  .catch(() => pushToast({ kind: 'error', title: t('copyFailed') }))
              }}
            >
              {t('copyAll')}
            </Button>
            <Button variant="danger" icon="trash" onClick={() => void clearLogs()}>
              {t('clearLogs')}
            </Button>
          </>
        }
      />

      <div className="logsbar">
        <Segmented value={level} options={LEVELS.map((entry) => ({ value: entry.value, label: t(entry.key) }))} onChange={(value) => setLevel(value as LogLevel | 'all')} />
        <label className="logsbar__auto">
          <input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} className="checkbox" />
          {t('autoScroll')}
        </label>
      </div>

      <Notice kind="accent" icon="shield">
        {t('logsNotice')}
      </Notice>

      <div className="loglist" ref={listRef} style={{ marginTop: 14, direction: 'ltr' }}>
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="loglist__empty">
            <Icon name="logs" size={22} />
            <div style={{ marginTop: 8 }}>{t('noLogs')}</div>
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
      <p className="field__hint" style={{ marginTop: 8, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
        {t('logsHint')}
      </p>
    </div>
  )
}
