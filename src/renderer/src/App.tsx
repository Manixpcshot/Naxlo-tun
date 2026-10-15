/**
 * App shell: animated background, titlebar, RTL navigation rail, page router
 * (animated with AnimatePresence), status bar and toasts.
 */
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Titlebar } from './components/Titlebar'
import { Sidebar, type PageId } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { Toasts } from './components/Toasts'
import { Home } from './pages/Home'
import { Servers } from './pages/Servers'
import { Subscription } from './pages/Subscription'
import { Settings } from './pages/Settings'
import { Logs } from './pages/Logs'
import { About } from './pages/About'
import { useStore } from './lib/store'
import { Spinner } from './components/Icon'

export default function App(): React.ReactElement {
  const { ready, settings } = useStore()
  const [page, setPage] = useState<PageId>('home')

  // Keyboard shortcuts (Persian-friendly: works regardless of layout).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.ctrlKey) return
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

  // Let the servers page deep-link into the subscription view.
  useEffect(() => {
    const handler = (): void => setPage('subscription')
    window.addEventListener('naxlo:goto-subscription', handler)
    return () => window.removeEventListener('naxlo:goto-subscription', handler)
  }, [])

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
              <Spinner size={26} className="spinner--lg" />
              <span>در حال آماده‌سازی ناکسلو…</span>
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
      <div className="aurora__vignette" />
    </div>
  )
}
