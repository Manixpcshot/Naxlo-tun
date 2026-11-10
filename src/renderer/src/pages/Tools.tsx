/**
 * Config toolbox.
 *
 * Two local-only tools that used to exist just on the website:
 *  - a validator for `vless/vmess/trojan/ss` links, running the shared rules
 *    from `@shared/linkcheck` (no IPC, no network, secrets masked), and
 *  - a QR builder so a config can be handed to the phone app by scanning.
 *
 * The QR of one of *your* servers is generated from the revealed link but the
 * link itself is never written into the page — only the code is rendered.
 */
import React, { useState } from 'react'
import QRCode from 'qrcode'
import { Icon } from '../components/Icon'
import { Button, Card, Field, Notice, PageHeader } from '../components/ui'
import { useStore } from '../lib/store'
import { useI18n } from '../lib/i18n'
import { inspectLink, type LinkInspection } from '@shared/linkcheck'

export function Tools(): React.ReactElement {
  const { servers, pushToast } = useStore()
  const { t, pick } = useI18n()
  const [link, setLink] = useState('')
  const [report, setReport] = useState<LinkInspection | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [qrNote, setQrNote] = useState<'none' | 'empty' | 'error'>('none')
  const [picked, setPicked] = useState('')

  const validate = (): void => setReport(inspectLink(link))

  const makeQr = async (value: string): Promise<void> => {
    const text = value.trim()
    if (!text) {
      setQr(null)
      setQrNote('empty')
      return
    }
    try {
      setQr(
        await QRCode.toDataURL(text, {
          margin: 2,
          width: 360,
          errorCorrectionLevel: 'M',
          color: { dark: '#0b0d12', light: '#ffffff' }
        })
      )
      setQrNote('none')
    } catch {
      setQr(null)
      setQrNote('error')
    }
  }

  const useServer = async (id: string): Promise<void> => {
    setPicked(id)
    if (!id) {
      setQr(null)
      setQrNote('none')
      return
    }
    const revealed = await window.naxlo.servers.reveal(id).catch(() => null)
    if (revealed?.raw) await makeQr(revealed.raw)
    else setQrNote('error')
  }

  const errors = report?.issues.filter((issue) => issue.level === 'error') ?? []
  const warnings = report?.issues.filter((issue) => issue.level === 'warning') ?? []

  return (
    <div>
      <PageHeader title={t('toolsTitle')} description={t('toolsDesc')} />

      <div className="tools-grid">
        <Card className="toolcard">
          <div className="card__title">
            <Icon name="search" size={15} /> {t('toolsValidator')}
          </div>
          <Field label={t('toolsPasteHint')}>
            <textarea
              className="input toolcard__input"
              value={link}
              spellCheck={false}
              dir="ltr"
              rows={4}
              placeholder="vless://uuid@host:443?type=ws&security=reality&pbk=…#name"
              onChange={(event) => setLink(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  validate()
                }
              }}
            />
          </Field>
          <div className="btn-row">
            <Button variant="primary" icon="check" onClick={validate}>
              {t('toolsValidate')}
            </Button>
            <Button icon="qr" onClick={() => void makeQr(link)}>
              {t('toolsQrMake')}
            </Button>
            <Button
              variant="ghost"
              icon="copy"
              disabled={!link.trim()}
              onClick={() => {
                void navigator.clipboard?.writeText(link.trim()).then(
                  () => pushToast({ kind: 'info', title: t('toolsCopied') }),
                  () => undefined
                )
              }}
            >
              {t('copyLink')}
            </Button>
          </div>

          {report ? (
            <div className="toolreport">
              {report.fields.length > 0 ? (
                <div className="toolchips">
                  {report.fields.map((field) => (
                    <span key={field.key} className="badge badge--muted toolchip">
                      {field.key}: {field.value}
                    </span>
                  ))}
                </div>
              ) : null}

              {errors.length === 0 && warnings.length === 0 ? (
                <Notice kind="accent" icon="check" title={t('toolsValid')} />
              ) : null}

              {errors.map((issue, index) => (
                <Notice key={`e${index}`} kind="danger" icon="error" title={pick(issue.text)} />
              ))}
              {warnings.map((issue, index) => (
                <Notice key={`w${index}`} kind="warning" icon="alert" title={pick(issue.text)} />
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="toolcard">
          <div className="card__title">
            <Icon name="qr" size={15} /> {t('toolsQrTitle')}
          </div>
          <div className="card__subtitle">{t('toolsQrHint')}</div>

          <div className="toolqr">
            {qr ? (
              <img className="toolqr__img" src={qr} alt="QR" width={220} height={220} />
            ) : (
              <div className="toolqr__empty">
                <Icon name="qr" size={34} />
                <span>{qrNote === 'error' ? t('errorTitle') : t('toolsQrEmpty')}</span>
              </div>
            )}
          </div>

          <Field label={t('toolsUseServer')}>
            <select className="input" value={picked} onChange={(event) => void useServer(event.target.value)}>
              <option value="">—</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </Field>
        </Card>
      </div>
    </div>
  )
}
