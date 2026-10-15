/**
 * Home — connection control, live status and the local proxy endpoints.
 */
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { PowerButton } from '../components/PowerButton'
import { Button, Card, Notice, Progress } from '../components/ui'
import { useStore } from '../lib/store'
import { CONNECTION_LABEL } from '../lib/labels'
import { fa, faDuration, faMs, maskIpLocal, shortDuration } from '../lib/format'
import type { PageId } from '../components/Sidebar'

interface Props {
  onNavigate: (page: PageId) => void
}

export function Home({ onNavigate }: Props): React.ReactElement {
  const { state, run, pushToast, settings } = useStore()
  const label = CONNECTION_LABEL[state.connection]
  const [now, setNow] = useState(Date.now())
  const [ipVisible, setIpVisible] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const connected = state.connection === 'connected'
  const busy = state.connection === 'preparing' || state.connection === 'starting' || state.connection === 'stopping'

  const toggle = async (): Promise<void> => {
    if (busy) return
    if (connected) {
      await run(() => window.naxlo.connection.disconnect(), 'قطع اتصال ناموفق بود')
    } else {
      await run(() => window.naxlo.connection.connect(), 'اتصال ناموفق بود')
    }
  }

  const refresh = async (): Promise<void> => {
    if (!state.subscription.hasUrl) {
      onNavigate('subscription')
      return
    }
    const report = await run(() => window.naxlo.subscription.refresh(), 'به‌روزرسانی اشتراک ناموفق بود')
    if (report) {
      pushToast({
        kind: 'success',
        title: 'اشتراک به‌روزرسانی شد',
        message: `${fa(report.total)} کانفیگ دریافت شد (${fa(report.supported)} مورد پشتیبانی)`
      })
    }
  }

  const uptime = state.startedAt ? now - state.startedAt : null

  return (
    <div>
      <motion.section
        className="card home-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="home-hero__glow" aria-hidden="true" data-tone={label.tone} />

        <div className="home-hero__inner">
          <div className="home-hero__power">
            <PowerButton
              connection={state.connection}
              onClick={() => void toggle()}
              disabled={busy}
              label={connected ? 'قطع اتصال' : 'اتصال'}
            />
          </div>

          <div className="home-hero__text">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={label.text}
                className="home-hero__title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
              >
                {label.text}
              </motion.h2>
            </AnimatePresence>

            <p className="home-hero__hint">
              {state.activeServerName && connected
                ? `ترافیک شما از طریق «${state.activeServerName}» عبور می‌کند.`
                : label.hint}
            </p>

            <div className="home-hero__actions">
              <Button variant="primary" icon={connected ? 'disconnect' : 'bolt'} onClick={() => void toggle()} loading={busy}>
                {connected ? 'قطع اتصال' : 'اتصال'}
              </Button>
              <Button
                icon="refresh"
                onClick={() => void refresh()}
                loading={state.subscription.fetching}
                disabled={busy}
              >
                به‌روزرسانی اشتراک
              </Button>
              <Button variant="ghost" icon="servers" onClick={() => onNavigate('servers')}>
                انتخاب سرور
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {state.core.downloading ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginTop: 18 }}
            >
              <Progress
                value={state.core.progress}
                indeterminate={state.core.progress === null}
                label="در حال دریافت هستهٔ Xray از مخزن رسمی…"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.section>

      <AnimatePresence>
        {state.lastError ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ marginTop: 16 }}
          >
            <Notice kind="danger" icon="error" title="خطا">
              {state.lastError}
            </Notice>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state.connection === 'core-missing' ? (
        <div style={{ marginTop: 16 }}>
          <Notice kind="warning" icon="cpu" title="هستهٔ Xray آماده نیست">
            ناکسلو برای ساخت پروکسی محلی به هستهٔ رسمی Xray نیاز دارد. می‌توانید آن را همین‌جا دانلود کنید یا فایل
            اجرایی را از تنظیمات انتخاب نمایید.
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="sm" variant="primary" icon="download" onClick={() => void run(() => window.naxlo.core.ensure(), 'دریافت هسته ناموفق بود')}>
                دانلود هسته
              </Button>
              <Button size="sm" icon="folder" onClick={() => void run(() => window.naxlo.core.pick(), 'انتخاب فایل ناموفق بود')}>
                انتخاب فایل xray.exe
              </Button>
            </div>
          </Notice>
        </div>
      ) : null}

      <div className="grid grid--4" style={{ marginTop: 18 }}>
        <Stat
          icon="globe"
          label="آی‌پی شما"
          value={
            state.identity ? (
              <span
                className="reveal mono"
                onClick={() => setIpVisible((v) => !v)}
                title={ipVisible ? 'پنهان کردن' : 'نمایش آی‌پی'}
              >
                {ipVisible ? state.identity.ip : maskIpLocal(state.identity.ip)}
                <span className="reveal__eye">
                  <Icon name={ipVisible ? 'eyeOff' : 'eye'} size={13} />
                </span>
              </span>
            ) : (
              '—'
            )
          }
          foot={state.identity?.country ? `${state.identity.country}${state.identity.city ? ` • ${state.identity.city}` : ''}` : connected ? 'در حال بررسی…' : 'پس از اتصال مشخص می‌شود'}
        />
        <Stat
          icon="gauge"
          label="تأخیر"
          value={faMs(state.latencyMs)}
          foot={connected ? 'زمان پاسخ از طریق پروکسی' : '—'}
        />
        <Stat
          icon="clock"
          label="مدت اتصال"
          value={shortDuration(uptime)}
          foot={uptime ? faDuration(uptime) : '—'}
        />
        <Stat
          icon="shield"
          label="حالت پروکسی"
          value={state.systemProxyApplied ? 'سیستمی' : 'دستی'}
          foot={
            settings.applySystemProxy
              ? state.systemProxyApplied
                ? 'ویندوز روی پروکسی ناکسلو تنظیم شد'
                : 'در انتظار اعمال'
              : 'فقط پروکسی محلی فعال است'
          }
        />
      </div>

      <Card className="endpoints" hover={false}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="card__title">
              <Icon name="link" size={15} /> آدرس پروکسی محلی
            </div>
            <div className="card__subtitle">
              بدون TUN و بدون درایور شبکه — هر برنامه‌ای را می‌توانید دستی روی این آدرس‌ها تنظیم کنید.
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon="copy"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`socks5://127.0.0.1:${state.socksPort}`)
                .then(() => pushToast({ kind: 'success', title: 'آدرس SOCKS5 کپی شد' }))
                .catch(() => pushToast({ kind: 'error', title: 'کپی ناموفق بود' }))
            }}
          >
            کپی SOCKS5
          </Button>
        </div>

        <div className="grid grid--2" style={{ marginTop: 14 }}>
          <EndpointRow
            title="SOCKS5"
            value={`127.0.0.1:${state.socksPort}`}
            hint="مناسب برای مرورگرها، ترمینال و بیشتر کلاینت‌ها (پشتیبانی از UDP)"
          />
          <EndpointRow
            title="HTTP"
            value={`127.0.0.1:${state.httpPort}`}
            hint="برای تنظیم پروکسی سیستم ویندوز و برنامه‌هایی که فقط HTTP پروکسی دارند"
          />
        </div>
      </Card>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  foot
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  value: React.ReactNode
  foot?: string
}): React.ReactElement {
  return (
    <motion.div
      className="stat"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, borderColor: 'var(--border-strong)' }}
    >
      <span className="stat__label">
        <Icon name={icon} size={13} /> {label}
      </span>
      <span className="stat__value">{value}</span>
      {foot ? <span className="stat__foot">{foot}</span> : null}
    </motion.div>
  )
}

function EndpointRow({ title, value, hint }: { title: string; value: string; hint: string }): React.ReactElement {
  return (
    <div className="endpoint">
      <div className="endpoint__head">
        <span className="badge badge--accent">{title}</span>
        <span className="mono endpoint__value">{value}</span>
      </div>
      <span className="field__hint">{hint}</span>
    </div>
  )
}
