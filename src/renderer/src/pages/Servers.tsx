/**
 * Servers — searchable list of every parsed config from the subscription.
 */
import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { ServerCard } from '../components/ServerCard'
import { Button, Modal, PageHeader, SkeletonRow } from '../components/ui'
import { useStore } from '../lib/store'
import { fa, normaliseForSearch } from '../lib/format'
import type { ServerView } from '@shared/bridge'

type Filter = 'all' | 'vless' | 'reality' | 'ws' | 'grpc' | 'fast'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'vless', label: 'VLESS' },
  { id: 'reality', label: 'REALITY' },
  { id: 'ws', label: 'WebSocket' },
  { id: 'grpc', label: 'gRPC' },
  { id: 'fast', label: 'سریع‌ترین‌ها' }
]

export function Servers(): React.ReactElement {
  const { servers, state, ready, run, pushToast, reloadServers } = useStore()
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
    if (sortFast) {
      list = [...list].sort((a, b) => (a.latencyMs ?? 1e9) - (b.latencyMs ?? 1e9))
    } else if (filter === 'fast') {
      list = [...list].sort((a, b) => (a.latencyMs ?? 1e9) - (b.latencyMs ?? 1e9))
    }
    return list
  }, [servers, query, filter, sortFast])

  const testOne = async (server: ServerView): Promise<void> => {
    setTestingId(server.id)
    await run(() => window.naxlo.servers.test(server.id), 'تست تأخیر ناموفق بود')
    await reloadServers()
    setTestingId(null)
  }

  const testAll = async (): Promise<void> => {
    setTestingAll(true)
    const poll = setInterval(() => void reloadServers(), 1500)
    await run(() => window.naxlo.servers.testAll(), 'تست گروهی ناموفق بود')
    await reloadServers()
    clearInterval(poll)
    setTestingAll(false)
  }

  const connect = async (server: ServerView): Promise<void> => {
    if (state.connection === 'connected') {
      await run(() => window.naxlo.connection.disconnect(), 'قطع اتصال ناموفق بود')
    }
    await run(() => window.naxlo.servers.select(server.id), 'انتخاب سرور ناموفق بود')
    await run(() => window.naxlo.connection.connect(server.id), 'اتصال ناموفق بود')
  }

  const copyLink = async (server: ServerView): Promise<void> => {
    const done = await run(() => window.naxlo.servers.copyLink(server.id), 'کپی لینک ناموفق بود')
    if (done) {
      pushToast({
        kind: 'warning',
        title: 'لینک کانفیگ کپی شد',
        message: 'این لینک حاوی کلید است؛ آن را در جای امن نگه دارید.'
      })
    }
  }

  const remove = async (server: ServerView): Promise<void> => {
    await run(() => window.naxlo.servers.remove(server.id), 'حذف ناموفق بود')
    pushToast({ kind: 'info', title: 'سرور حذف شد', message: server.name })
  }

  return (
    <div>
      <PageHeader
        title="سرورها"
        description={`${fa(state.subscription.totalConfigs)} کانفیگ در خزانهٔ رمزنگاری‌شده • ${fa(
          state.subscription.supportedConfigs
        )} مورد قابل استفاده`}
        actions={
          <>
            <Button icon="gauge" onClick={() => void testAll()} loading={testingAll} disabled={!servers.length}>
              تست تأخیر همه
            </Button>
            <Button icon="refresh" onClick={() => void run(() => window.naxlo.subscription.refresh(), 'به‌روزرسانی ناموفق بود')} loading={state.subscription.fetching}>
              به‌روزرسانی اشتراک
            </Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirmClear(true)} disabled={!servers.length}>
              پاک کردن فهرست
            </Button>
          </>
        }
      />

      <div className="serverbar">
        <div className="search" style={{ flex: '1 1 280px' }}>
          <span className="search__icon">
            <Icon name="search" size={15} />
          </span>
          <input
            className="input"
            placeholder="جست‌وجوی نام سرور، پروتکل یا لایهٔ امنیتی…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="chips">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${filter === item.id ? 'chip--active' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant={sortFast ? 'primary' : 'ghost'}
          icon="filter"
          onClick={() => setSortFast((v) => !v)}
          title="مرتب‌سازی بر اساس تأخیر"
        >
          مرتب‌سازی بر اساس سرعت
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
        <motion.div
          className="empty"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <span className="empty__icon">
            <Icon name="servers" size={24} />
          </span>
          <span className="empty__title">
            {servers.length === 0 ? 'هنوز سروری اضافه نشده است' : 'نتیجه‌ای برای این جست‌وجو پیدا نشد'}
          </span>
          <span className="empty__desc">
            {servers.length === 0
              ? 'لینک اشتراک خود را در بخش «اشتراک» وارد کنید تا کانفیگ‌های VLESS دریافت و به این فهرست اضافه شوند.'
              : 'عبارت جست‌وجو یا فیلتر انتخابی را تغییر دهید.'}
          </span>
          {servers.length === 0 ? <Button variant="primary" icon="subscription" onClick={() => window.dispatchEvent(new CustomEvent('naxlo:goto-subscription'))}>رفتن به بخش اشتراک</Button> : null}
        </motion.div>
      ) : (
        <div className="serverlist" role="listbox" aria-label="فهرست سرورها">
          <AnimatePresence initial={false}>
            {filtered.slice(0, 300).map((server, index) => (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.018, 0.4), type: 'spring', stiffness: 380, damping: 32 }}
              >
                <ServerCard
                  server={server}
                  selected={state.selectedServerId === server.id}
                  active={state.connection === 'connected' && state.activeServerId === server.id}
                  testing={testingId === server.id}
                  onSelect={() => void run(() => window.naxlo.servers.select(server.id), 'انتخاب ناموفق بود')}
                  onConnect={() => void connect(server)}
                  onTest={() => void testOne(server)}
                  onCopy={() => void copyLink(server)}
                  onRemove={() => void remove(server)}
                  onReveal={() => run(() => window.naxlo.servers.reveal(server.id), 'نمایش جزئیات ناموفق بود')}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length > 300 ? (
            <p className="field__hint" style={{ textAlign: 'center', padding: '12px 0' }}>
              {fa(filtered.length - 300)} مورد دیگر برای روان‌ماندن فهرست پنهان شده‌اند — از جست‌وجو استفاده کنید.
            </p>
          ) : null}
        </div>
      )}

      <Modal
        open={confirmClear}
        title="پاک کردن فهرست سرورها؟"
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                void run(() => window.naxlo.servers.clear(), 'پاک‌سازی ناموفق بود').then(() => {
                  setConfirmClear(false)
                  pushToast({ kind: 'info', title: 'فهرست سرورها پاک شد' })
                })
              }}
            >
              پاک کن
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              انصراف
            </Button>
          </>
        }
      >
        همهٔ کانفیگ‌های دریافت‌شده از اشتراک حذف می‌شوند. لینک اشتراک شما دست‌نخورده باقی می‌ماند و می‌توانید دوباره
        آن را به‌روزرسانی کنید.
      </Modal>
    </div>
  )
}
