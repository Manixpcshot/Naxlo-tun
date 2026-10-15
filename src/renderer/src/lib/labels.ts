/**
 * Connection state → Persian copy. Single place so the whole UI agrees.
 */
import type { ConnectionState, Protocol, NetworkType, SecurityType, RouteMode } from '@shared/bridge'
import type { IconName } from '../components/Icon'

export interface ConnectionLabel {
  text: string
  tone: 'idle' | 'busy' | 'connected' | 'error'
  hint: string
}

export const CONNECTION_LABEL: Record<ConnectionState, ConnectionLabel> = {
  idle: { text: 'متصل نیستید', tone: 'idle', hint: 'برای شروع، یک سرور را انتخاب و دکمهٔ اتصال را بزنید.' },
  preparing: { text: 'در حال آماده‌سازی…', tone: 'busy', hint: 'هستهٔ Xray و کانفیگ در حال بررسی هستند.' },
  starting: { text: 'در حال راه‌اندازی پروکسی…', tone: 'busy', hint: 'پروکسی محلی در حال ساختن تونل است.' },
  connected: { text: 'متصل هستید', tone: 'connected', hint: 'ترافیک از پروکسی محلی ناکسلو عبور می‌کند.' },
  stopping: { text: 'در حال قطع اتصال…', tone: 'busy', hint: 'پروکسی در حال بسته‌شدن و بازگردانی تنظیمات است.' },
  error: { text: 'خطا در اتصال', tone: 'error', hint: 'جزئیات خطا در پایین نمایش داده شده است.' },
  'core-missing': { text: 'هستهٔ Xray آماده نیست', tone: 'error', hint: 'هسته را دانلود کنید یا فایل اجرایی را انتخاب نمایید.' }
}

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  vless: 'VLESS',
  vmess: 'VMess',
  trojan: 'Trojan',
  shadowsocks: 'Shadowsocks',
  unknown: 'ناشناخته'
}

export const NETWORK_LABEL: Record<NetworkType, string> = {
  tcp: 'TCP',
  ws: 'WebSocket',
  grpc: 'gRPC',
  h2: 'HTTP/2',
  quic: 'QUIC',
  kcp: 'mKCP',
  splithttp: 'SplitHTTP',
  xhttp: 'XHTTP',
  unknown: '—'
}

export const SECURITY_LABEL: Record<SecurityType, string> = {
  none: 'بدون رمزنگاری لایهٔ انتقال',
  tls: 'TLS',
  reality: 'REALITY',
  xtls: 'XTLS'
}

export const ROUTE_MODE_LABEL: Record<RouteMode, { label: string; hint: string }> = {
  'all-proxy': {
    label: 'همه از پروکسی',
    hint: 'تمام ترافیک (به‌جز لوکال‌هاست و شبکهٔ داخلی) از سرور عبور می‌کند.'
  },
  'iran-direct': {
    label: 'سایت‌های ایران مستقیم',
    hint: 'دامنه‌ها و آی‌پی‌های ایرانی مستقیم و بقیه از پروکسی عبور می‌کنند.'
  },
  'lan-direct': {
    label: 'شبکهٔ داخلی مستقیم',
    hint: 'فقط آدرس‌های خصوصی و لوکال مستقیم می‌شوند.'
  }
}

export const PAGE_ICON: Record<string, IconName> = {
  home: 'bolt',
  servers: 'servers',
  subscription: 'subscription',
  settings: 'settings',
  logs: 'logs',
  about: 'info'
}
