/**
 * Servers — searchable list with flags, filters and latency testing.
 */
import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { ServerCard } from '../components/ServerCard'
import { Button, Modal, PageHeader, SkeletonRow } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'
import { fa, normaliseForSearch } from '../lib/format'
import type { ServerView } from '@shared/bridge'

type Filter = 'all' | 'vless' | 'reality' | 'ws' | 'grpc' | 'fast'

const FILTERS: Array<{ id: Filter; key?: MsgKey; text?: string }> = [
  { id: 'all', key: 'filterAll' },
  { id: 'vless', text: 'VLESS' },
  { id: 'reality', text: 'REALITY' },
  { id: 'ws', text: 'WebSocket' },
  { id: 'grpc', text: 'gRPC' },
  { id: 'fast', key: 'filterFast' }
]

export function Servers(): React.ReactElement {
  const { servers, state, ready, run, pushToast, reloadServers } = useStore()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sortFast, setSortFast] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testingAll, setTestingAll] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const filtered = useMemo(() => {
    const q = normaliseForSearch(query)
    let list = servers.filter((server) => {
      if (q) {
        const haystack = normaliseForSearch(
          `${server.name} ${server.addressMasked} ${server.protocol} ${server.network} ${server.security}`
        )
        if (!haystack.includes(q)) return false
      }
      switch (filter) {
        case 'vless':
          return server.protocol === 'vless'
        case 'reality':
          return server.security === 'reality'
        case 'ws':
          return server.network === 'ws'
        case 'grpc':
          return server.network === 'grpc'
        case 'fast':
          return server.supported && server.latencyMs !== null && server.latencyMs < 400
        default:
          return true
      }
    })
    if (sortFast || filter === 'fast') {
      list = [...list].sort((a, b) => (a.latencyMs ?? 1e9) - (b.latencyMs ?? 1e9))
    }
    return list
  }, [servers, query, filter, sortFast])

  const testOne = async (server: ServerView): Promise<void> => {
    setTestingId(server.id)
    await run(() => window.naxlo.servers.test(server.id), t('errorTitle'))
    await reloadServers()
    setTestingId(null)
  }

  const testAll = async (): Promise<void> => {
    setTestingAll(true)
    const poll = setInterval(() => void reloadServers(), 1500)
    await run(() => window.naxlo.servers.testAll(), t('errorTitle'))
    await reloadServers()
    clearInterval(poll)
    setTestingAll(false)
  }

  const connect = async (server: ServerView): Promise<void> => {
    if (state.connection === 'connected') await run(() => window.naxlo.connection.disconnect(), t('errorTitle'))
    await run(() => window.naxlo.servers.select(server.id), t('errorTitle'))
    await run(() => window.naxlo.connection.connect(server.id), t('errorTitle'))
  }

  const copyLink = async (server: ServerView): Promise<void> => {
    const done = await run(() => window.naxlo.servers.copyLink(server.id), t('errorTitle'))
    if (done) pushToast({ kind: 'warning', title: t('copiedLinkTitle'), message: t('copiedLinkBody') })
  }

  const remove = async (server: ServerView): Promise<void> => {
    await run(() => window.naxlo.servers.remove(server.id), t('errorTitle'))
    pushToast({ kind: 'info', title: t('removedToast'), message: server.name })
  }

  return (
    <div>
      <PageHeader
        title={t('serversTitle')}
        description={t('serversDesc', {
          total: fa(state.subscription.totalConfigs),
          supported: fa(state.subscription.supportedConfigs)
        })}
        actions={
          <>
            <Button icon="gauge" onClick={() => void testAll()} loading={testingAll} disabled={!servers.length}>
              {t('testAll')}
            </Button>
            <Button
              icon="refresh"
              onClick={() => void run(() => window.naxlo.subscription.refresh(), t('errorTitle'))}
              loading={state.subscription.fetching}
            >
              {t('refreshSubscription')}
            </Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirmClear(true)} disabled={!servers.length}>
              {t('clearList')}
            </Button>
          </>
        }
      />

      <div className="serverbar">
        <div className="search" style={{ flex: '1 1 260px' }}>
          <span className="search__icon">
            <Icon name="search" size={15} />
          </span>
          <input className="input" placeholder={t('searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="chips">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${filter === item.id ? 'chip--active' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.key ? t(item.key) : item.text}
            </button>
          ))}
        </div>

        <Button size="sm" variant={sortFast ? 'primary' : 'ghost'} icon="filter" onClick={() => setSortFast((v) => !v)} title={t('sortBySpeed')}>
          {t('sortBySpeed')}
        </Button>
      </div>

      {!ready ? (
        <div className="serverlist">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="server" key={index} style={{ cursor: 'default' }}>
              <SkeletonRow width={18} height={18} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SkeletonRow width="42%" height={13} />
                <SkeletonRow width="26%" height={11} />
              </div>
              <SkeletonRow width={120} height={26} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div className="empty" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <span className="empty__icon">
            <Icon name="servers" size={24} />
          </span>
          <span className="empty__title">{servers.length === 0 ? t('emptyServersTitle') : t('emptySearchTitle')}</span>
          <span className="empty__desc">{servers.length === 0 ? t('emptyServersDesc') : t('emptySearchDesc')}</span>
          {servers.length === 0 ? (
            <Button variant="primary" icon="subscription" onClick={() => window.dispatchEvent(new CustomEvent('naxlo:goto-subscription'))}>
              {t('gotoSubscription')}
            </Button>
          ) : null}
        </motion.div>
      ) : (
        <div className="serverlist" role="listbox" aria-label="servers">
          <AnimatePresence initial={false}>
            {filtered.slice(0, 300).map((server, index) => (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.016, 0.35), type: 'spring', stiffness: 380, damping: 32 }}
              >
                <ServerCard
                  server={server}
                  selected={state.selectedServerId === server.id}
                  active={state.connection === 'connected' && state.activeServerId === server.id}
                  testing={testingId === server.id}
                  onSelect={() => void run(() => window.naxlo.servers.select(server.id), t('errorTitle'))}
                  onConnect={() => void connect(server)}
                  onTest={() => void testOne(server)}
                  onCopy={() => void copyLink(server)}
                  onRemove={() => void remove(server)}
                  onReveal={() => run(() => window.naxlo.servers.reveal(server.id), t('errorTitle'))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length > 300 ? (
            <p className="field__hint" style={{ textAlign: 'center', padding: '12px 0' }}>
              {t('hiddenMore', { n: fa(filtered.length - 300) })}
            </p>
          ) : null}
        </div>
      )}

      <Modal
        open={confirmClear}
        title={t('clearConfirmTitle')}
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                void run(() => window.naxlo.servers.clear(), t('errorTitle')).then(() => {
                  setConfirmClear(false)
                  pushToast({ kind: 'info', title: t('clearedToast') })
                })
              }}
            >
              {t('clearAction')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t('cancel')}
            </Button>
          </>
        }
      >
        {t('clearConfirmBody')}
      </Modal>
    </div>
  )
}
