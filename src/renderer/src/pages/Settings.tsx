/**
 * Settings — ports, routing, core management, appearance and the danger zone.
 */
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Button, Card, Field, Modal, Notice, PageHeader, Progress, Segmented, Toggle } from '../components/ui'
import { useStore } from '../lib/store'
import { ROUTE_MODE_LABEL } from '../lib/labels'
import { fa } from '../lib/format'
import type { RouteMode, Settings as SettingsType } from '@shared/bridge'

const ACCENTS: Array<{ id: SettingsType['accent']; label: string; color: string }> = [
  { id: 'cyan', label: 'فیروزه‌ای', color: '#22d3ee' },
  { id: 'violet', label: 'بنفش', color: '#9b8cfb' },
  { id: 'emerald', label: 'زمردی', color: '#3fd6a4' },
  { id: 'amber', label: 'کهربایی', color: '#e8b268' },
  { id: 'rose', label: 'صورتی', color: '#f08a9b' }
]

const LOG_LEVELS = [
  { value: 'error', label: 'فقط خطا' },
  { value: 'warn', label: 'خطا و هشدار' },
  { value: 'info', label: 'معمولی' },
  { value: 'debug', label: 'پرجزئیات' }
]

export function Settings(): React.ReactElement {
  const { settings, saveSettings, state, run, pushToast } = useStore()
  const [updateInfo, setUpdateInfo] = useState<{ current: string | null; latest: string | null; updateAvailable: boolean } | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState(false)

  const patch = (partial: Partial<SettingsType>): void => {
    void saveSettings(partial).catch(() => pushToast({ kind: 'error', title: 'ذخیرهٔ تنظیمات ناموفق بود' }))
  }

  const numberField = (key: 'socksPort' | 'httpPort', value: number): React.ReactElement => (
    <input
      className="input input--mono"
      type="number"
      min={1024}
      max={65535}
      value={value}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next) && next >= 1024 && next <= 65535) patch({ [key]: next } as Partial<SettingsType>)
      }}
    />
  )

  return (
    <div>
      <PageHeader
        title="تنظیمات"
        description="پورت‌های پروکسی محلی، مسیریابی ترافیک، هستهٔ Xray و رفتار برنامه."
      />

      <div className="settings-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div className="card__title">
              <Icon name="link" size={15} /> پروکسی محلی
            </div>
            <div className="card__subtitle">
              ناکسلو فقط اینباند لوکال می‌سازد؛ هیچ درایور شبکه یا TUN نصب نمی‌شود.
            </div>

            <div className="grid grid--2" style={{ marginTop: 16 }}>
              <Field label="پورت SOCKS5" hint="برای مرورگرها و کلاینت‌های پشتیبان UDP">
                {numberField('socksPort', settings.socksPort)}
              </Field>
              <Field label="پورت HTTP" hint="برای پروکسی سیستم ویندوز">
                {numberField('httpPort', settings.httpPort)}
              </Field>
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Toggle
                checked={settings.applySystemProxy}
                onChange={(value) => patch({ applySystemProxy: value })}
                title="تنظیم خودکار پروکسی ویندوز"
                description="هنگام اتصال، پروکسی سیستم روی پورت HTTP تنظیم و هنگام قطع، تنظیمات قبلی بازگردانی می‌شود."
              />
              <Toggle
                checked={settings.autoConnectLast}
                onChange={(value) => patch({ autoConnectLast: value })}
                title="اتصال خودکار در شروع به کار ویندوز"
                description="اگر برنامه با ورود به ویندوز اجرا شود، به آخرین سرور متصل می‌شود."
              />
            </div>
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="filter" size={15} /> مسیریابی ترافیک
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="حالت مسیریابی" hint={ROUTE_MODE_LABEL[settings.routeMode].hint}>
                <Segmented<RouteMode>
                  value={settings.routeMode}
                  options={(Object.keys(ROUTE_MODE_LABEL) as RouteMode[]).map((mode) => ({
                    value: mode,
                    label: ROUTE_MODE_LABEL[mode].label
                  }))}
                  onChange={(mode) => patch({ routeMode: mode })}
                />
              </Field>

              <Toggle
                checked={settings.blockAds}
                onChange={(value) => patch({ blockAds: value })}
                title="مسدودسازی تبلیغات"
                description="دامنه‌های دستهٔ تبلیغات (geosite) پیش از رسیدن به پروکسی مسدود می‌شوند."
              />
              <Toggle
                checked={settings.muxEnabled}
                onChange={(value) => patch({ muxEnabled: value })}
                title="مالتی‌پلکسینگ (Mux)"
                description="چند جریان روی یک اتصال؛ می‌تواند تأخیر را کم کند اما گاهی پایداری را کاهش می‌دهد."
              />
              {settings.muxEnabled ? (
                <Field label={`تعداد جریان هم‌زمان: ${fa(settings.muxConcurrency)}`}>
                  <input
                    type="range"
                    min={1}
                    max={32}
                    value={settings.muxConcurrency}
                    onChange={(event) => patch({ muxConcurrency: Number(event.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </Field>
              ) : null}
              <Toggle
                checked={settings.allowInsecure}
                onChange={(value) => patch({ allowInsecure: value })}
                title="اجازه به گواهی نامعتبر (allowInsecure)"
                description="فقط اگر سرور شما گواهی خودامضا دارد. امنیت اتصال را کاهش می‌دهد."
              />
            </div>
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="globe" size={15} /> تست اتصال
            </div>
            <div className="card__subtitle">آدرسی که پس از برقراری پروکسی برای سنجش واقعی اتصال استفاده می‌شود.</div>
            <div style={{ marginTop: 14 }}>
              <Field label="آدرس تست" hint="پاسخ سریع و بدون محتوا بهترین گزینه است (مانند generate_204).">
                <input
                  className="input input--mono"
                  value={settings.testUrl}
                  spellCheck={false}
                  onChange={(event) => patch({ testUrl: event.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div className="card__title">
              <Icon name="cpu" size={15} /> هستهٔ Xray
            </div>
            <div className="kv" style={{ marginTop: 14 }}>
              <span className="kv__key">وضعیت</span>
              <span className="kv__val">
                {state.core.ready ? (
                  <span className="badge badge--success">آماده</span>
                ) : (
                  <span className="badge badge--danger">نصب نشده</span>
                )}
              </span>
              <span className="kv__key">نسخه</span>
              <span className="kv__val mono">{state.core.version ?? '—'}</span>
              <span className="kv__key">منبع</span>
              <span className="kv__val">
                {state.core.source === 'bundled'
                  ? 'همراه برنامه'
                  : state.core.source === 'downloaded'
                    ? 'دانلود شده'
                    : state.core.source === 'custom'
                      ? 'فایل انتخابی شما'
                      : state.core.source === 'dev'
                        ? 'محیط توسعه'
                        : '—'}
              </span>
              <span className="kv__key">مسیر</span>
              <span className="kv__val mono" style={{ fontSize: 11 }}>
                {state.core.path ?? '—'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <Button
                icon="download"
                variant="primary"
                onClick={() => void run(() => window.naxlo.core.ensure(), 'دریافت هسته ناموفق بود')}
                loading={state.core.downloading}
              >
                {state.core.ready ? 'بازبینی و نصب هسته' : 'دانلود و نصب هسته'}
              </Button>
              <Button icon="folder" onClick={() => void run(() => window.naxlo.core.pick(), 'انتخاب فایل ناموفق بود')}>
                انتخاب فایل اجرایی
              </Button>
              <Button
                icon="refresh"
                variant="ghost"
                onClick={async () => {
                  const info = await run(() => window.naxlo.core.checkUpdate(), 'بررسی به‌روزرسانی ناموفق بود')
                  if (info) {
                    setUpdateInfo(info)
                    pushToast({
                      kind: info.updateAvailable ? 'info' : 'success',
                      title: info.updateAvailable ? 'نسخهٔ جدیدتر موجود است' : 'هستهٔ شما به‌روز است',
                      message: info.updateAvailable ? `نسخهٔ ${info.latest} منتشر شده است` : undefined
                    })
                  }
                }}
              >
                بررسی نسخهٔ جدید
              </Button>
            </div>

            <AnimatePresence>
              {state.core.downloading ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ marginTop: 14 }}>
                  <Progress
                    value={state.core.progress}
                    indeterminate={state.core.progress === null}
                    label={
                      state.core.progress === null
                        ? 'در حال اتصال به مخزن رسمی…'
                        : `${fa(Math.round((state.core.progress ?? 0) * 100))}٪ دریافت شد`
                    }
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {updateInfo?.updateAvailable ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: 14 }}>
                  <Notice kind="warning" icon="alert" title="نسخهٔ جدید هسته">
                    نسخهٔ فعلی {updateInfo.current ?? '—'} و آخرین نسخهٔ منتشرشده {updateInfo.latest ?? '—'} است.
                  </Notice>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {state.core.error ? (
              <div style={{ marginTop: 14 }}>
                <Notice kind="danger" icon="error" title="خطای هسته">
                  {state.core.error}
                </Notice>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="settings" size={15} /> رفتار و ظاهر
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Toggle
                checked={settings.autoStart}
                onChange={(value) => patch({ autoStart: value })}
                title="اجرا هنگام ورود به ویندوز"
              />
              <Toggle
                checked={settings.minimizeToTray}
                onChange={(value) => patch({ minimizeToTray: value })}
                title="باقی ماندن در ناحیهٔ اعلان‌ها هنگام بستن پنجره"
                description="اتصال شما با بستن پنجره قطع نمی‌شود."
              />
              <Toggle
                checked={settings.reduceMotion}
                onChange={(value) => patch({ reduceMotion: value })}
                title="کاهش انیمیشن‌ها"
                description="برای سیستم‌های ضعیف‌تر یا حساسیت به حرکت."
              />

              <Field label="رنگ تأکیدی">
                <div className="accent-picker">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      className={`accent-dot ${settings.accent === accent.id ? 'accent-dot--active' : ''}`}
                      style={{ background: accent.color }}
                      title={accent.label}
                      aria-label={accent.label}
                      onClick={() => patch({ accent: accent.id })}
                    />
                  ))}
                </div>
              </Field>

              <Field label="سطح گزارش‌ها">
                <Segmented
                  value={settings.logLevel}
                  options={LOG_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                  onChange={(value) => patch({ logLevel: value as SettingsType['logLevel'] })}
                />
              </Field>
            </div>
          </Card>

          <Card className="danger">
            <div className="card__title" style={{ color: 'var(--danger)' }}>
              <Icon name="alert" size={15} /> منطقهٔ خطر
            </div>
            <div className="card__subtitle">
              حذف اشتراک، سرورها و تنظیمات از روی این دستگاه. اگر متصل هستید ابتدا اتصال قطع می‌شود.
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="danger" icon="trash" onClick={() => setConfirmWipe(true)} loading={wiping}>
                پاک‌سازی کامل داده‌ها
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmWipe}
        title="پاک‌سازی کامل داده‌ها؟"
        onClose={() => setConfirmWipe(false)}
        actions={
          <>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                setWiping(true)
                void run(async () => {
                  await window.naxlo.connection.disconnect()
                  await window.naxlo.subscription.clear()
                  await window.naxlo.settings.set({ corePath: null })
                }, 'پاک‌سازی ناموفق بود').then(() => {
                  setWiping(false)
                  setConfirmWipe(false)
                  pushToast({ kind: 'info', title: 'همهٔ داده‌ها پاک شد' })
                })
              }}
            >
              پاک کن
            </Button>
            <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
              انصراف
            </Button>
          </>
        }
      >
        لینک اشتراک، کانفیگ‌ها، سرور انتخاب‌شده و هستهٔ دانلودشده حذف می‌شوند. برای استفادهٔ دوباره باید اشتراک را
        وارد کنید.
      </Modal>
    </div>
  )
}
