/**
 * About — version info, architecture notes and licences.
 */
import React, { useState } from 'react'
import { motion } from 'motion/react'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { Button, Card, Notice, PageHeader } from '../components/ui'
import { useStore } from '../lib/store'

const LINKS = [
  { label: 'مخزن پروژه در گیت‌هاب', url: 'https://github.com/Manixpcshot/Naxlo-tun', icon: 'external' as const },
  { label: 'هستهٔ Xray-core', url: 'https://github.com/XTLS/Xray-core', icon: 'cpu' as const },
  { label: 'قلم وزیرمتن', url: 'https://github.com/rastikerdar/vazirmatn', icon: 'link' as const },
  { label: 'مستندات Electron', url: 'https://electronjs.org', icon: 'info' as const }
]

export function About(): React.ReactElement {
  const { info, pushToast } = useStore()
  const [update, setUpdate] = useState<{ current: string; latest: string | null; updateAvailable: boolean; releaseUrl: string | null } | null>(null)
  const [checking, setChecking] = useState(false)

  const checkUpdate = async (): Promise<void> => {
    setChecking(true)
    const result = await window.naxlo.app.checkUpdate().catch(() => null)
    setChecking(false)
    if (result) {
      setUpdate(result)
      pushToast({
        kind: result.updateAvailable ? 'info' : 'success',
        title: result.updateAvailable ? 'نسخهٔ جدید ناکسلو منتشر شد' : 'ناکسلو به‌روز است',
        message: result.updateAvailable ? `نسخهٔ ${result.latest} در دسترس است` : `نسخهٔ نصب‌شده: ${result.current}`
      })
    } else {
      pushToast({ kind: 'error', title: 'بررسی به‌روزرسانی ناموفق بود' })
    }
  }

  return (
    <div>
      <PageHeader title="دربارهٔ ناکسلو" description="کلاینت سبک و فارسی‌زبان VLESS برای ویندوز، بدون TUN و بدون درایور." />

      <div className="grid grid--2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="about-hero">
            <Logo size={62} animated />
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>naxlo</div>
              <div className="mono" style={{ color: 'var(--text-mute)', fontSize: 12 }}>
                version {info?.version ?? '1.0.0'}
              </div>
            </div>
          </div>

          <div className="kv" style={{ marginTop: 20 }}>
            <span className="kv__key">Electron</span>
            <span className="kv__val mono">{info?.electron ?? '—'}</span>
            <span className="kv__key">Node</span>
            <span className="kv__val mono">{info?.node ?? '—'}</span>
            <span className="kv__key">Chromium</span>
            <span className="kv__val mono">{info?.chrome ?? '—'}</span>
            <span className="kv__key">سکوی اجرا</span>
            <span className="kv__val mono">
              {info?.platform ?? '—'} / {info?.arch ?? '—'}
            </span>
            <span className="kv__key">محافظت از خزانه</span>
            <span className="kv__val">
              {info?.protection === 'safeStorage'
                ? 'DPAPI ویندوز (کلید سیستمی)'
                : info?.protection === 'aes-256-gcm'
                  ? 'AES-256-GCM با کلید مشتق از دستگاه'
                  : 'در دسترس نیست — داده‌ها ذخیره نمی‌شوند'}
            </span>
            <span className="kv__key">پوشهٔ داده</span>
            <span className="kv__val mono" style={{ fontSize: 11 }}>
              {info?.userData ?? '—'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <Button variant="primary" icon="refresh" onClick={() => void checkUpdate()} loading={checking}>
              بررسی نسخهٔ جدید برنامه
            </Button>
            <Button
              icon="folder"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(info?.userData ?? '')
                  .then(() => pushToast({ kind: 'success', title: 'مسیر پوشهٔ داده کپی شد' }))
                  .catch(() => pushToast({ kind: 'error', title: 'کپی ناموفق بود' }))
              }}
            >
              کپی مسیر داده‌ها
            </Button>
          </div>
          {update?.updateAvailable ? (
            <div style={{ marginTop: 14 }}>
              <Notice kind="warning" icon="download" title={`نسخهٔ ${update.latest} منتشر شده است`}>
                برای دریافت نسخهٔ جدید به صفحهٔ ریلیزها در گیت‌هاب بروید.
                <div style={{ marginTop: 10 }}>
                  <Button size="sm" icon="external" onClick={() => void window.naxlo.shell.open(update.releaseUrl ?? 'https://github.com/Manixpcshot/Naxlo-tun/releases')}>
                    صفحهٔ ریلیز
                  </Button>
                </div>
              </Notice>
            </div>
          ) : null}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div className="card__title">
              <Icon name="shield" size={15} /> امنیت و حریم خصوصی
            </div>
            <ul className="about-list">
              <li>لینک اشتراک و کلیدها فقط در خزانهٔ رمزنگاری‌شدهٔ کاربر (DPAPI) ذخیره می‌شوند.</li>
              <li>هیچ مقدار حساسی در کنسول، فایل گزارش یا رابط کاربری نوشته نمی‌شود؛ همه‌جا پوشیده است.</li>
              <li>کانفیگ Xray در فایلی با دسترسی ۰۶۰۰ نوشته و پس از خاموش‌شدن هسته حذف می‌شود.</li>
              <li>پروکسی سیستم ویندوز پیش از تغییر پشتیبان‌گیری و هنگام قطع بازگردانی می‌شود.</li>
              <li>بدون TUN، بدون Wintun، بدون سرویس سیستمی و بدون دسترسی مدیریتی.</li>
              <li>هستهٔ Xray از مخزن رسمی دانلود و با SHA-512 منتشرشده اعتبارسنجی می‌شود.</li>
            </ul>
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="external" size={15} /> پیوندها
            </div>
            <div className="about-links" style={{ marginTop: 14 }}>
              {LINKS.map((link) => (
                <motion.button
                  key={link.url}
                  type="button"
                  className="about-link"
                  whileHover={{ x: -3 }}
                  onClick={() => void window.naxlo.shell.open(link.url).catch(() => undefined)}
                >
                  <Icon name={link.icon} size={15} />
                  {link.label}
                </motion.button>
              ))}
            </div>
          </Card>

          <Notice kind="accent" icon="info" title="پروانه">
            ناکسلو با پروانهٔ MIT منتشر می‌شود. هستهٔ Xray با پروانهٔ MPL-2.0 و قلم وزیرمتن با پروانهٔ OFL عرضه
            می‌شوند. این برنامه هیچ وابستگی به سرویس یا شرکت خاصی ندارد.
          </Notice>
        </div>
      </div>
    </div>
  )
}
