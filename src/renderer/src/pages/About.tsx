/**
 * About — version, protection, links, licences. Bilingual.
 */
import React, { useState } from 'react'
import { motion } from 'motion/react'
import { Icon, type IconName } from '../components/Icon'
import { Logo } from '../components/Logo'
import { Button, Card, Notice, PageHeader } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n, type MsgKey } from '../lib/i18n'

const LINKS: Array<{ key: MsgKey; url: string; icon: IconName }> = [
  { key: 'linkRepo', url: 'https://github.com/Manixpcshot/Naxlo-tun', icon: 'external' },
  { key: 'linkXray', url: 'https://github.com/XTLS/Xray-core', icon: 'cpu' },
  { key: 'linkFont', url: 'https://github.com/rastikerdar/vazirmatn', icon: 'link' },
  { key: 'linkElectron', url: 'https://electronjs.org', icon: 'info' }
]

export function About(): React.ReactElement {
  const { info, pushToast } = useStore()
  const { t } = useI18n()
  const [checking, setChecking] = useState(false)

  const checkUpdate = async (): Promise<void> => {
    setChecking(true)
    const result = await window.naxlo.app.checkUpdate().catch(() => null)
    setChecking(false)
    if (result) {
      pushToast({
        kind: result.updateAvailable ? 'info' : 'success',
        title: result.updateAvailable ? t('appUpdateAvailable') : t('appUpToDate'),
        message: result.updateAvailable
          ? t('appUpdateAutoBody', { v: result.latest ?? '—' })
          : t('appUpToDateBody', { v: result.current })
      })
    } else {
      pushToast({ kind: 'error', title: t('updateCheckFailed') })
    }
  }

  const protection =
    info?.protection === 'safeStorage'
      ? t('protectionSafe')
      : info?.protection === 'aes-256-gcm'
        ? t('protectionAes')
        : t('protectionNone')

  return (
    <div>
      <PageHeader title={t('aboutTitle')} description={t('aboutDesc')} />

      <div className="grid grid--2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="about-hero">
            <Logo size={62} animated />
            <div>
              <div className="about-hero__name">naxlo</div>
              <div className="mono about-hero__version">version {info?.version ?? '1.0.0'}</div>
            </div>
          </div>

          <div className="kv" style={{ marginTop: 20 }}>
            <span className="kv__key">{t('aboutElectron')}</span>
            <span className="kv__val mono">{info?.electron ?? '—'}</span>
            <span className="kv__key">Node</span>
            <span className="kv__val mono">{info?.node ?? '—'}</span>
            <span className="kv__key">Chromium</span>
            <span className="kv__val mono">{info?.chrome ?? '—'}</span>
            <span className="kv__key">{t('aboutPlatform')}</span>
            <span className="kv__val mono">
              {info?.platform ?? '—'} / {info?.arch ?? '—'}
            </span>
            <span className="kv__key">{t('aboutProtection')}</span>
            <span className="kv__val">{protection}</span>
            <span className="kv__key">{t('aboutDataDir')}</span>
            <span className="kv__val mono" style={{ fontSize: 11 }}>
              {info?.userData ?? '—'}
            </span>
          </div>

          <div className="btn-row" style={{ marginTop: 18 }}>
            <Button variant="primary" icon="refresh" onClick={() => void checkUpdate()} loading={checking}>
              {t('checkAppUpdate')}
            </Button>
            <Button
              icon="folder"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(info?.userData ?? '')
                  .then(() => pushToast({ kind: 'success', title: t('dataDirCopied') }))
                  .catch(() => pushToast({ kind: 'error', title: t('copyFailed') }))
              }}
            >
              {t('copyDataDir')}
            </Button>
          </div>
        </Card>

        <div className="setting-col">
          <Card>
            <div className="card__title">
              <Icon name="shield" size={15} /> {t('securityTitle')}
            </div>
            <ul className="about-list">
              {([1, 2, 3, 4, 5, 6] as const).map((index) => (
                <li key={index}>{t(`security${index}` as MsgKey)}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="card__title">
              <Icon name="external" size={15} /> {t('linksTitle')}
            </div>
            <div className="about-links">
              {LINKS.map((link) => (
                <motion.button
                  key={link.url}
                  type="button"
                  className="about-link"
                  whileHover={{ x: -3 }}
                  onClick={() => void window.naxlo.shell.open(link.url).catch(() => undefined)}
                >
                  <Icon name={link.icon} size={15} />
                  {t(link.key)}
                </motion.button>
              ))}
            </div>
          </Card>

          <Notice kind="accent" icon="info" title={t('licenseTitle')}>
            {t('licenseBody')}
          </Notice>
        </div>
      </div>
    </div>
  )
}
