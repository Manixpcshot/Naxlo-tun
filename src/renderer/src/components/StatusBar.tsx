/**
 * Bottom status strip: connection, ports, core, uptime and proxy state.
 */
import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import { useStore } from '../lib/store'
import { CONNECTION_LABEL } from '../lib/labels'
import { faMs, shortDuration } from '../lib/format'

export function StatusBar(): React.ReactElement {
  const { state } = useStore()
  const label = CONNECTION_LABEL[state.connection]
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const uptime = state.startedAt ? now - state.startedAt : null

  return (
    <footer className="statusbar">
      <span className="statusbar__item">
        <motion.span
          animate={{
            backgroundColor:
              label.tone === 'connected'
                ? 'var(--success)'
                : label.tone === 'error'
                  ? 'var(--danger)'
                  : label.tone === 'busy'
                    ? 'var(--warning)'
                    : 'rgba(255,255,255,0.25)'
          }}
          transition={{ duration: 0.4 }}
          style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }}
        />
        {label.text}
      </span>

      <span className="statusbar__sep" />

      <span className="statusbar__item mono">
        <Icon name="link" size={13} />
        SOCKS5 127.0.0.1:{state.socksPort}
      </span>
      <span className="statusbar__item mono">
        <Icon name="globe" size={13} />
        HTTP 127.0.0.1:{state.httpPort}
      </span>

      <span className="statusbar__sep" />

      <span className="statusbar__item">
        <Icon name="cpu" size={13} />
        هسته: {state.core.version ? `${state.core.version}` : 'نصب نشده'}
      </span>

      {state.connection === 'connected' ? (
        <>
          <span className="statusbar__sep" />
          <span className="statusbar__item">
            <Icon name="clock" size={13} />
            {shortDuration(uptime)}
          </span>
          <span className="statusbar__item">
            <Icon name="gauge" size={13} />
            {faMs(state.latencyMs)}
          </span>
        </>
      ) : null}

      <span className="statusbar__spacer" />

      <span className="statusbar__item">
        <Icon name={state.systemProxyApplied ? 'shield' : 'alert'} size={13} />
        {state.systemProxyApplied ? 'پروکسی سیستم فعال است' : 'پروکسی سیستم اعمال نشده'}
      </span>
    </footer>
  )
}
