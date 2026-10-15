/**
 * Frameless titlebar.
 *
 * The bar itself is laid out physically left-to-right regardless of the app
 * language, so the window controls always sit on the RIGHT edge (Windows
 * convention) while the brand stays on the left. The Persian brand text is
 * Latin ("naxlo"), so this reads naturally in both languages.
 */
import React from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import { Logo } from './Logo'
import { useStore } from '../lib/store'
import { useI18n } from '../lib/i18n'

export function Titlebar(): React.ReactElement {
  const { state } = useStore()
  const { t, lang, setLang } = useI18n()

  const statusKey =
    state.connection === 'connected'
      ? 'stateConnected'
      : state.connection === 'idle'
        ? 'stateIdle'
        : state.connection === 'error' || state.connection === 'core-missing'
          ? stateErrorKey(state.connection)
          : busyKey(state.connection)

  const call = (fn: () => Promise<unknown>): void => {
    void fn().catch(() => undefined)
  }

  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <span className="titlebar__logo">
          <Logo size={22} animated />
        </span>
        <span>naxlo</span>
        <span className="titlebar__tag">{t('appTagline')}</span>
      </div>

      <div className="titlebar__spacer" />

      <div className="titlebar__hint">
        <motion.span
          key={statusKey}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
        >
          {t(statusKey)}
        </motion.span>
        {state.connection === 'connected' ? (
          <span className="eq" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>

      <div className="titlebar__controls">
        <button
          className="winbtn winbtn--lang"
          title={t('languageSwitchTitle')}
          onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
        >
          <span className="winbtn__lang">{t('languageSwitch')}</span>
        </button>
        <span className="titlebar__sep" aria-hidden="true" />
        <button className="winbtn" title={t('windowMinimize')} onClick={() => call(() => window.naxlo.window.minimize())}>
          <Icon name="minimize" size={15} />
        </button>
        <button className="winbtn" title={t('windowMaximize')} onClick={() => call(() => window.naxlo.window.toggleMaximize())}>
          <Icon name="maximize" size={15} />
        </button>
        <button className="winbtn winbtn--close" title={t('windowClose')} onClick={() => call(() => window.naxlo.window.close())}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </header>
  )
}

function stateErrorKey(connection: string): 'stateError' | 'stateCoreMissing' {
  return connection === 'core-missing' ? 'stateCoreMissing' : 'stateError'
}

function busyKey(connection: string): 'statePreparing' | 'stateStarting' | 'stateStopping' {
  if (connection === 'preparing') return 'statePreparing'
  if (connection === 'stopping') return 'stateStopping'
  return 'stateStarting'
}
