/**
 * Protocol / transport labels (protocol names are language-neutral; the
 * transport-security description is bilingual).
 */
import type { LString } from '@shared/i18n'
import type { SecurityType } from '@shared/bridge'

export const SECURITY_LABEL: Record<SecurityType, LString> = {
  none: { fa: 'بدون لایهٔ امنیتی', en: 'No transport security' },
  tls: { fa: 'TLS', en: 'TLS' },
  reality: { fa: 'REALITY', en: 'REALITY' },
  xtls: { fa: 'XTLS', en: 'XTLS' }
}

export const ROUTE_MODE_KEY = {
  'all-proxy': 'routeAllProxy',
  'iran-direct': 'routeIranDirect',
  'lan-direct': 'routeLanDirect'
} as const
