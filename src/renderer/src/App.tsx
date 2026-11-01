/**
 * App shell: animated background, titlebar, navigation rail, animated pages,
 * status bar and toasts.
 */
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Titlebar } from './components/Titlebar'
import { Sidebar, PAGES, type PageId } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { Toasts } from './components/Toasts'
import { Home } from './pages/Home'
import { Servers } from './pages/Servers'
import { Subscription } from './pages/Subscription'
import { Settings } from './pages/Settings'
import { Logs } from './pages/Logs'
import { About } from './pages/About'
import { useStore } from './lib/store'
import { useI18n } from './lib/i18n'
import { Logo } from './components/Logo'

export default function App(): React.ReactElement {
  const { ready, settings } = useStore()
  const { t } = useI18n()
  const [page, setPage] = useState<PageId>('home')

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      // Never steal Ctrl+<digit> while the user is typing in a field.
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      const key = event.key.toLowerCase()
      if (key === '1') setPage('home')
      else if (key === '2') setPage('servers')
      else if (key === '3') setPage('subscription')
      else if (key === '4') setPage('settings')
      else if (key === '5') setPage('logs')
      else if (key === '6') setPage('about')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const handler = (): void => setPage('subscription')
    window.addEventListener('naxlo:goto-subscription', handler)
    return () => window.removeEventListener('naxlo:goto-subscription', handler)
  }, [])

  /* Keep the OS window/taskbar title in sync with the active page. */
  useEffect(() => {
    const label = page === 'home' ? null : t(PAGES.find((entry) => entry.id === page)?.label ?? 'navHome')
    document.title = label ? `Naxlo — ${label}` : 'Naxlo'
  }, [page, t])

  const reduce = settings.reduceMotion

  return (
    <div className="app">
      <Aurora disabled={reduce} />
      <Titlebar />

      <div className="app__body">
        <Sidebar page={page} onNavigate={setPage} />

        <main className="app__main">
          {!ready ? (
            <div className="boot">
              <span className="boot__mark">
                <Logo size={68} animated />
              </span>
              <span className="boot__word">naxlo</span>
              <span className="boot__bar" aria-hidden="true">
                <span />
              </span>
              <span className="boot__hint">{t('boot')}</span>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={page}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.994 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.996 }}
                transition={{ duration: reduce ? 0.08 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {page === 'home' ? <Home onNavigate={setPage} /> : null}
                {page === 'servers' ? <Servers /> : null}
                {page === 'subscription' ? <Subscription onNavigate={setPage} /> : null}
                {page === 'settings' ? <Settings /> : null}
                {page === 'logs' ? <Logs /> : null}
                {page === 'about' ? <About /> : null}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      <StatusBar />
      <Toasts />
    </div>
  )
}

function Aurora({ disabled }: { disabled: boolean }): React.ReactElement {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora__blob aurora__blob--a" style={disabled ? { animation: 'none' } : undefined} />
      <div className="aurora__blob aurora__blob--b" style={disabled ? { animation: 'none' } : undefined} />
      <div className="aurora__grid" />
      {!disabled ? <div className="aurora__scan" /> : null}
      <div className="aurora__noise" />
      <div className="aurora__vignette" />
    </div>
  )
}
