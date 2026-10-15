/**
 * Bottom status strip.
 */
import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import { Flag } from './Flag'
import { useStore } from '../lib/store'
import { useI18n } from '../lib/i18n'
import { faMs, shortDuration } from '../lib/format'

export function StatusBar(): React.ReactElement {
  const { state } = useStore()
  const { t } = useI18n()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const connected = state.connection === 'connected'
  const uptime = state.startedAt ? now - state.startedAt : null

  const tone = connected
    ? 'var(--success)'
    : state.connection === 'error' || state.connection === 'core-missing'
      ? 'var(--danger)'
      : state.connection === 'idle'
        ? 'rgba(255,255,255,0.25)'
        : 'var(--warning)'

  return (
    <footer className="statusbar">
      <span className="statusbar__item">
        <motion.span
          animate={{ backgroundColor: tone }}
          transition={{ duration: 0.4 }}
          className="statusbar__dot"
        />
        {t(
          connected
            ? 'stateConnected'
            : state.connection === 'idle'
              ? 'stateIdle'
              : state.connection === 'error'
                ? 'stateError'
                : state.connection === 'core-missing'
                  ? 'stateCoreMissing'
                  : state.connection === 'stopping'
                    ? 'stateStopping'
                    : state.connection === 'preparing'
                      ? 'statePreparing'
                      : 'stateStarting'
        )}
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
        {t('statusCore')} {state.core.version ?? t('statusCoreMissing')}
      </span>

      {connected ? (
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
          {state.identity?.countryCode ? (
            <span className="statusbar__item">
              <Flag code={state.identity.countryCode} />
              {state.identity.country ?? state.identity.countryCode.toUpperCase()}
            </span>
          ) : null}
        </>
      ) : null}

      <span className="statusbar__spacer" />

      <span className="statusbar__item">
        <Icon name={state.systemProxyApplied ? 'shield' : 'alert'} size={13} />
        {state.systemProxyApplied ? t('statusProxyOn') : t('statusProxyOff')}
      </span>
    </footer>
  )
}
