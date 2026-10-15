/**
 * Subscription — paste a link, fetch, decode and inspect what came back.
 *
 * The URL is treated as a secret: it is stored encrypted, shown masked, and the
 * only way to see it again is an explicit reveal action.
 */
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Button, Card, Field, Modal, Notice, PageHeader, Segmented } from '../components/ui'
import { useStore } from '../lib/store'
import { fa, faRelative } from '../lib/format'
import type { PageId } from '../components/Sidebar'

interface Props {
  onNavigate: (page: PageId) => void
}

const REFRESH_OPTIONS = [
  { value: '0', label: 'خاموش' },
  { value: '60', label: 'هر ساعت' },
  { value: '360', label: 'هر ۶ ساعت' },
  { value: '720', label: 'هر ۱۲ ساعت' },
  { value: '1440', label: 'هر روز' }
]

export function Subscription({ onNavigate }: Props): React.ReactElement {
  const { state, settings, saveSettings, run, pushToast, reloadServers } = useStore()
  const [url, setUrl] = useState('')
  const [visible, setVisible] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [revealing, setRevealing] = useState(false)

  const save = async (): Promise<void> => {
    if (!url.trim()) {
      pushToast({ kind: 'warning', title: 'لینک اشتراک خالی است' })
      return
    }
    const report = await run(() => window.naxlo.subscription.save(url.trim()), 'دریافت اشتراک ناموفق بود')
    if (report) {
      pushToast({
        kind: 'success',
        title: 'اشتراک دریافت شد',
        message: `${fa(report.total)} کانفیگ • ${fa(report.supported)} مورد پشتیبانی‌شده`
      })
      await reloadServers()
      setUrl('')
      setVisible(false)
      if (report.total > 0) onNavigate('servers')
    }
  }

  const refresh = async (): Promise<void> => {
    const report = await run(() => window.naxlo.subscription.refresh(), 'به‌روزرسانی ناموفق بود')
    if (report) {
      pushToast({
        kind: 'success',
        title: 'اشتراک به‌روزرسانی شد',
        message: `${fa(report.total)} کانفیگ دریافت شد`
      })
      await reloadServers()
    }
  }

  const importFile = async (): Promise<void> => {
    const report = await run(() => window.naxlo.subscription.importFile(), 'وارد کردن فایل ناموفق بود')
    if (report && 'total' in report) {
      pushToast({ kind: 'success', title: 'کانفیگ‌ها اضافه شدند', message: `${fa(report.total)} مورد در فهرست` })
      await reloadServers()
    }
  }

  const reveal = async (): Promise<void> => {
    setRevealing(true)
    const value = await run(() => window.naxlo.subscription.reveal(), 'نمایش لینک ناموفق بود')
    setRevealing(false)
    if (value) {
      setUrl(value)
      setVisible(true)
    }
  }

  const sub = state.subscription

  return (
    <div>
      <PageHeader
        title="اشتراک"
        description="لینک اشتراک خود را وارد کنید؛ ناکسلو فایل TXT را دریافت، Base64 را بازگشایی و کانفیگ‌ها را تجزیه می‌کند."
        actions={
          <>
            <Button icon="refresh" onClick={() => void refresh()} loading={sub.fetching} disabled={!sub.hasUrl}>
              به‌روزرسانی
            </Button>
            <Button icon="folder" onClick={() => void importFile()} disabled={sub.fetching}>
              وارد کردن از فایل
            </Button>
          </>
        }
      />

      <div className="grid grid--2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="subbox">
            <Field
              label="لینک اشتراک"
              hint="لینک شما به‌صورت رمزنگاری‌شده روی همین دستگاه ذخیره می‌شود و هرگز در گزارش‌ها نوشته نمی‌شود."
              htmlFor="sub-url"
            >
              <div className="input-group">
                <input
                  id="sub-url"
                  className="input input--mono"
                  type={visible ? 'text' : 'password'}
                  placeholder="https://example.com/sub/xxxxxxxx"
                  value={url}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void save()
                  }}
                />
                <Button
                  variant="ghost"
                  icon={visible ? 'eyeOff' : 'eye'}
                  onClick={() => setVisible((v) => !v)}
                  title={visible ? 'پنهان کردن' : 'نمایش'}
                  className="btn--icon"
                />
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="primary" icon="download" onClick={() => void save()} loading={sub.fetching}>
                ذخیره و دریافت کانفیگ‌ها
              </Button>
              {sub.hasUrl ? (
                <>
                  <Button icon="eye" onClick={() => void reveal()} loading={revealing}>
                    نمایش لینک ذخیره‌شده
                  </Button>
                  <Button variant="danger" icon="trash" onClick={() => setConfirmClear(true)}>
                    حذف اشتراک
                  </Button>
                </>
              ) : null}
            </div>

            <AnimatePresence>
              {sub.hasUrl ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Notice kind="accent" icon="lock" title="اشتراک فعال">
                    <span className="mono" style={{ direction: 'ltr', display: 'inline-block' }}>
                      {sub.maskedUrl}
                    </span>
                    <br />
                    آخرین به‌روزرسانی: {faRelative(sub.lastUpdated)}
                  </Notice>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {sub.lastError ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Notice kind="danger" icon="error" title="خطای دریافت اشتراک">
                    {sub.lastError}
                  </Notice>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div className="card__title">
              <Icon name="activity" size={15} /> وضعیت اشتراک
            </div>
            <div className="substats" style={{ marginTop: 14 }}>
              <MiniStat label="کل کانفیگ‌ها" value={fa(sub.totalConfigs)} />
              <MiniStat label="پشتیبانی‌شده" value={fa(sub.supportedConfigs)} />
              <MiniStat label="آخرین دریافت" value={faRelative(sub.lastUpdated)} small />
              <MiniStat
                label="به‌روزرسانی خودکار"
                value={settings.autoRefreshMinutes ? `هر ${fa(Math.round(settings.autoRefreshMinutes / 60))} ساعت` : 'خاموش'}
                small
              />
            </div>
          </Card>

          <Card>
            <Field label="به‌روزرسانی خودکار اشتراک" hint="در پس‌زمینه و بدون قطع اتصال فعلی انجام می‌شود.">
              <Segmented
                value={String(settings.autoRefreshMinutes)}
                options={REFRESH_OPTIONS}
                onChange={(value) => void saveSettings({ autoRefreshMinutes: Number(value) })}
              />
            </Field>
          </Card>

          <Notice kind="accent" icon="shield" title="حریم خصوصی">
            لینک اشتراک، کلیدها و آدرس سرورها داخل یک خزانهٔ رمزنگاری‌شده (DPAPI ویندوز) نگه‌داری می‌شوند، در رابط
            کاربری به‌صورت پوشیده نمایش داده می‌شوند و هیچ‌گاه در فایل گزارش نوشته نمی‌شوند.
          </Notice>
        </div>
      </div>

      <Modal
        open={confirmClear}
        title="حذف اشتراک و همهٔ سرورها؟"
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                void run(() => window.naxlo.subscription.clear(), 'حذف ناموفق بود').then(async () => {
                  setConfirmClear(false)
                  await reloadServers()
                  pushToast({ kind: 'info', title: 'اشتراک و سرورها حذف شدند' })
                })
              }}
            >
              حذف کن
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              انصراف
            </Button>
          </>
        }
      >
        اگر متصل هستید، ابتدا اتصال قطع می‌شود. سپس لینک اشتراک و تمام کانفیگ‌ها از خزانهٔ رمزنگاری‌شده پاک می‌شوند.
        این عمل قابل بازگشت نیست.
      </Modal>
    </div>
  )
}

function MiniStat({
  label,
  value,
  small = false
}: {
  label: string
  value: string
  small?: boolean
}): React.ReactElement {
  return (
    <div className="stat" style={{ padding: 12 }}>
      <span className="stat__label">{label}</span>
      <span style={{ fontSize: small ? 13 : 17, fontWeight: 700 }}>{value}</span>
    </div>
  )
}
