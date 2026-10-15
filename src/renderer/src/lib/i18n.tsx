/**
 * Renderer internationalisation (fa / en).
 *
 * `t('key')` resolves against the active language from settings; `pick()`
 * renders bilingual payloads produced by the main process.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import type { LString, Lang } from '@shared/i18n'
import { isLString } from '@shared/i18n'
import { setFormatLocale } from './format'
import { TR } from './i18n-tr'
import { useStore } from './store'

export type MsgKey = keyof typeof MESSAGES

export const MESSAGES = {
  /* ---------------- shell ---------------- */
  appTagline: { fa: 'پروکسی محلی VLESS', en: 'Local VLESS proxy' },
  menu: { fa: 'منو', en: 'Menu' },
  navHome: { fa: 'اتصال', en: 'Connect' },
  navServers: { fa: 'سرورها', en: 'Servers' },
  navSubscription: { fa: 'اشتراک', en: 'Subscription' },
  navSettings: { fa: 'تنظیمات', en: 'Settings' },
  navLogs: { fa: 'گزارش‌ها', en: 'Logs' },
  navAbout: { fa: 'درباره', en: 'About' },
  windowMinimize: { fa: 'کمینه کردن', en: 'Minimize' },
  windowMaximize: { fa: 'بزرگ‌نمایی', en: 'Maximize' },
  windowClose: { fa: 'بستن (برنامه در پس‌زمینه می‌ماند)', en: 'Close (app keeps running)' },
  languageSwitch: { fa: 'English', en: 'فارسی' },
  languageSwitchTitle: { fa: 'تغییر زبان به انگلیسی', en: 'Switch language to Persian' },

  /* ---------------- connection states ---------------- */
  stateIdle: { fa: 'متصل نیستید', en: 'Not connected' },
  stateIdleHint: { fa: 'برای شروع، یک سرور را انتخاب و دکمهٔ اتصال را بزنید.', en: 'Pick a server and press connect to get started.' },
  statePreparing: { fa: 'در حال آماده‌سازی…', en: 'Preparing…' },
  statePreparingHint: { fa: 'هستهٔ Xray و کانفیگ در حال بررسی هستند.', en: 'Checking the Xray core and config.' },
  stateStarting: { fa: 'در حال راه‌اندازی پروکسی…', en: 'Starting proxy…' },
  stateStartingHint: { fa: 'پروکسی محلی در حال ساختن تونل است.', en: 'The local proxy is building the tunnel.' },
  stateConnected: { fa: 'متصل هستید', en: 'Connected' },
  stateConnectedHint: { fa: 'ترافیک از پروکسی محلی ناکسلو عبور می‌کند.', en: 'Traffic flows through the Naxlo local proxy.' },
  stateStopping: { fa: 'در حال قطع اتصال…', en: 'Disconnecting…' },
  stateStoppingHint: { fa: 'پروکسی در حال بسته‌شدن و بازگردانی تنظیمات است.', en: 'Closing the proxy and restoring settings.' },
  stateError: { fa: 'خطا در اتصال', en: 'Connection error' },
  stateErrorHint: { fa: 'جزئیات خطا در پایین نمایش داده شده است.', en: 'Error details are shown below.' },
  stateCoreMissing: { fa: 'هستهٔ Xray آماده نیست', en: 'Xray core not ready' },
  stateCoreMissingHint: { fa: 'هسته را دانلود کنید یا فایل اجرایی را انتخاب نمایید.', en: 'Download the core or choose an executable.' },

  /* ---------------- home ---------------- */
  homeTrafficVia: { fa: 'ترافیک شما از طریق «{name}» عبور می‌کند.', en: 'Your traffic flows through “{name}”.' },
  connect: { fa: 'اتصال', en: 'Connect' },
  disconnect: { fa: 'قطع اتصال', en: 'Disconnect' },
  refreshSubscription: { fa: 'به‌روزرسانی اشتراک', en: 'Refresh subscription' },
  chooseServer: { fa: 'انتخاب سرور', en: 'Choose server' },
  downloadingCore: { fa: 'در حال دریافت هستهٔ Xray از مخزن رسمی…', en: 'Downloading the official Xray core…' },
  errorTitle: { fa: 'خطا', en: 'Error' },
  coreMissingTitle: { fa: 'هستهٔ Xray آماده نیست', en: 'Xray core not ready' },
  coreMissingBody: {
    fa: 'ناکسلو برای ساخت پروکسی محلی به هستهٔ رسمی Xray نیاز دارد. می‌توانید آن را همین‌جا دانلود کنید یا فایل اجرایی را از تنظیمات انتخاب نمایید.',
    en: 'Naxlo needs the official Xray core to build the local proxy. Download it here or pick an executable from Settings.'
  },
  downloadCore: { fa: 'دانلود هسته', en: 'Download core' },
  pickCoreFile: { fa: 'انتخاب فایل xray.exe', en: 'Choose xray.exe' },
  statIp: { fa: 'آی‌پی شما', en: 'Your IP' },
  statIpFootConnected: { fa: 'در حال بررسی…', en: 'Checking…' },
  statIpFootIdle: { fa: 'پس از اتصال مشخص می‌شود', en: 'Shown after connecting' },
  statLatency: { fa: 'تأخیر', en: 'Latency' },
  statLatencyFoot: { fa: 'زمان پاسخ از طریق پروکسی', en: 'Round-trip through the proxy' },
  statUptime: { fa: 'مدت اتصال', en: 'Session' },
  statProxyMode: { fa: 'حالت پروکسی', en: 'Proxy mode' },
  proxyModeSystem: { fa: 'سیستمی', en: 'System-wide' },
  proxyModeManual: { fa: 'دستی', en: 'Manual' },
  proxyModeApplied: { fa: 'ویندوز روی پروکسی ناکسلو تنظیم شد', en: 'Windows is pointed at Naxlo' },
  proxyModePending: { fa: 'در انتظار اعمال', en: 'Pending' },
  proxyModeOff: { fa: 'فقط پروکسی محلی فعال است', en: 'Local proxy only' },
  endpointsTitle: { fa: 'آدرس پروکسی محلی', en: 'Local proxy endpoints' },
  endpointsSubtitle: {
    fa: 'بدون TUN و بدون درایور شبکه — هر برنامه‌ای را می‌توانید دستی روی این آدرس‌ها تنظیم کنید.',
    en: 'No TUN, no network driver — point any app at these endpoints manually.'
  },
  copySocks: { fa: 'کپی SOCKS5', en: 'Copy SOCKS5' },
  socksHint: { fa: 'مناسب برای مرورگرها، ترمینال و بیشتر کلاینت‌ها (پشتیبانی از UDP)', en: 'For browsers, terminals and most clients (UDP supported)' },
  httpHint: { fa: 'برای تنظیم پروکسی سیستم ویندوز و برنامه‌هایی که فقط HTTP پروکسی دارند', en: 'For the Windows system proxy and HTTP-only apps' },
  copiedSocks: { fa: 'آدرس SOCKS5 کپی شد', en: 'SOCKS5 address copied' },
  copyFailed: { fa: 'کپی ناموفق بود', en: 'Copy failed' },
  showIp: { fa: 'نمایش آی‌پی', en: 'Reveal IP' },
  hideIp: { fa: 'پنهان کردن آی‌پی', en: 'Hide IP' },

  /* ---------------- servers ---------------- */
  serversTitle: { fa: 'سرورها', en: 'Servers' },
  serversDesc: { fa: '{total} کانفیگ در خزانهٔ رمزنگاری‌شده • {supported} مورد قابل استفاده', en: '{total} configs in the encrypted vault • {supported} usable' },
  testAll: { fa: 'تست تأخیر همه', en: 'Test all latency' },
  clearList: { fa: 'پاک کردن فهرست', en: 'Clear list' },
  searchPlaceholder: { fa: 'جست‌وجوی نام سرور، پروتکل یا لایهٔ امنیتی…', en: 'Search name, protocol or security…' },
  filterAll: { fa: 'همه', en: 'All' },
  filterFast: { fa: 'سریع‌ترین‌ها', en: 'Fastest' },
  sortBySpeed: { fa: 'مرتب‌سازی بر اساس سرعت', en: 'Sort by speed' },
  emptyServersTitle: { fa: 'هنوز سروری اضافه نشده است', en: 'No servers yet' },
  emptyServersDesc: {
    fa: 'لینک اشتراک خود را در بخش «اشتراک» وارد کنید تا کانفیگ‌های VLESS دریافت و به این فهرست اضافه شوند.',
    en: 'Add your subscription link in the Subscription tab to fetch VLESS configs into this list.'
  },
  emptySearchTitle: { fa: 'نتیجه‌ای برای این جست‌وجو پیدا نشد', en: 'No results for this search' },
  emptySearchDesc: { fa: 'عبارت جست‌وجو یا فیلتر انتخابی را تغییر دهید.', en: 'Try a different query or filter.' },
  gotoSubscription: { fa: 'رفتن به بخش اشتراک', en: 'Go to subscription' },
  hiddenMore: { fa: '{n} مورد دیگر برای روان‌ماندن فهرست پنهان شده‌اند — از جست‌وجو استفاده کنید.', en: '{n} more entries hidden to keep the list smooth — use search.' },
  clearConfirmTitle: { fa: 'پاک کردن فهرست سرورها؟', en: 'Clear the server list?' },
  clearConfirmBody: {
    fa: 'همهٔ کانفیگ‌های دریافت‌شده از اشتراک حذف می‌شوند. لینک اشتراک شما دست‌نخورده باقی می‌ماند و می‌توانید دوباره آن را به‌روزرسانی کنید.',
    en: 'All configs fetched from the subscription are removed. Your subscription link is kept and can be refreshed again.'
  },
  clearAction: { fa: 'پاک کن', en: 'Clear' },
  cancel: { fa: 'انصراف', en: 'Cancel' },
  clearedToast: { fa: 'فهرست سرورها پاک شد', en: 'Server list cleared' },
  removedToast: { fa: 'سرور حذف شد', en: 'Server removed' },
  copiedLinkTitle: { fa: 'لینک کانفیگ کپی شد', en: 'Config link copied' },
  copiedLinkBody: { fa: 'این لینک حاوی کلید است؛ آن را در جای امن نگه دارید.', en: 'This link contains a credential — keep it safe.' },
  untested: { fa: 'تست نشده', en: 'untested' },
  testLatency: { fa: 'تست تأخیر', en: 'Test latency' },
  copyLink: { fa: 'کپی لینک', en: 'Copy link' },
  remove: { fa: 'حذف', en: 'Remove' },
  inUse: { fa: 'در حال استفاده', en: 'in use' },
  insecure: { fa: 'ناامن', en: 'Insecure' },

  /* ---------------- subscription ---------------- */
  subscriptionTitle: { fa: 'اشتراک', en: 'Subscription' },
  subscriptionDesc: {
    fa: 'لینک اشتراک خود را وارد کنید؛ ناکسلو فایل TXT را دریافت، Base64 را بازگشایی و کانفیگ‌ها را تجزیه می‌کند.',
    en: 'Paste your subscription link; Naxlo fetches the TXT file, decodes Base64 and parses the configs.'
  },
  refresh: { fa: 'به‌روزرسانی', en: 'Refresh' },
  importFile: { fa: 'وارد کردن از فایل', en: 'Import from file' },
  urlLabel: { fa: 'لینک اشتراک', en: 'Subscription URL' },
  urlHint: {
    fa: 'لینک شما به‌صورت رمزنگاری‌شده روی همین دستگاه ذخیره می‌شود و هرگز در گزارش‌ها نوشته نمی‌شود.',
    en: 'Stored encrypted on this device and never written to logs.'
  },
  urlPlaceholder: { fa: 'https://example.com/sub/xxxxxxxx', en: 'https://example.com/sub/xxxxxxxx' },
  saveAndFetch: { fa: 'ذخیره و دریافت کانفیگ‌ها', en: 'Save & fetch configs' },
  revealStored: { fa: 'نمایش لینک ذخیره‌شده', en: 'Reveal stored link' },
  deleteSubscription: { fa: 'حذف اشتراک', en: 'Delete subscription' },
  activeSubscription: { fa: 'اشتراک فعال', en: 'Active subscription' },
  lastUpdate: { fa: 'آخرین به‌روزرسانی:', en: 'Last update:' },
  subErrorTitle: { fa: 'خطای دریافت اشتراک', en: 'Subscription error' },
  subStatus: { fa: 'وضعیت اشتراک', en: 'Subscription status' },
  totalConfigs: { fa: 'کل کانفیگ‌ها', en: 'Total configs' },
  supportedConfigs: { fa: 'پشتیبانی‌شده', en: 'Supported' },
  lastFetch: { fa: 'آخرین دریافت', en: 'Last fetch' },
  autoRefreshLabel: { fa: 'به‌روزرسانی خودکار', en: 'Auto refresh' },
  autoRefreshField: { fa: 'به‌روزرسانی خودکار اشتراک', en: 'Automatic subscription refresh' },
  autoRefreshHint: { fa: 'در پس‌زمینه و بدون قطع اتصال فعلی انجام می‌شود.', en: 'Runs in the background without dropping the current connection.' },
  refreshOff: { fa: 'خاموش', en: 'Off' },
  refreshHourly: { fa: 'هر ساعت', en: 'Hourly' },
  refresh6h: { fa: 'هر ۶ ساعت', en: 'Every 6h' },
  refresh12h: { fa: 'هر ۱۲ ساعت', en: 'Every 12h' },
  refreshDaily: { fa: 'هر روز', en: 'Daily' },
  privacyTitle: { fa: 'حریم خصوصی', en: 'Privacy' },
  privacyBody: {
    fa: 'لینک اشتراک، کلیدها و آدرس سرورها داخل یک خزانهٔ رمزنگاری‌شده (DPAPI ویندوز) نگه‌داری می‌شوند، در رابط کاربری به‌صورت پوشیده نمایش داده می‌شوند و هیچ‌گاه در فایل گزارش نوشته نمی‌شوند.',
    en: 'The subscription link, keys and server addresses live in an encrypted vault (Windows DPAPI), appear masked in the UI and are never written to the log file.'
  },
  fetchedToast: { fa: 'اشتراک دریافت شد', en: 'Subscription fetched' },
  refreshedToast: { fa: 'اشتراک به‌روزرسانی شد', en: 'Subscription refreshed' },
  fetchedBody: { fa: '{total} کانفیگ • {supported} مورد پشتیبانی‌شده', en: '{total} configs • {supported} supported' },
  importedToast: { fa: 'کانفیگ‌ها اضافه شدند', en: 'Configs imported' },
  importedBody: { fa: '{total} مورد در فهرست', en: '{total} in the list' },
  emptyUrlToast: { fa: 'لینک اشتراک خالی است', en: 'Subscription URL is empty' },
  clearSubConfirmTitle: { fa: 'حذف اشتراک و همهٔ سرورها؟', en: 'Delete subscription and all servers?' },
  clearSubConfirmBody: {
    fa: 'اگر متصل هستید، ابتدا اتصال قطع می‌شود. سپس لینک اشتراک و تمام کانفیگ‌ها از خزانهٔ رمزنگاری‌شده پاک می‌شوند. این عمل قابل بازگشت نیست.',
    en: 'If connected, the session ends first. Then the link and all configs are wiped from the encrypted vault. This cannot be undone.'
  },
  deleteAction: { fa: 'حذف کن', en: 'Delete' },
  clearedSubToast: { fa: 'اشتراک و سرورها حذف شدند', en: 'Subscription and servers removed' },
  never: { fa: 'هرگز', en: 'never' },

  /* --------- smart connect, pins, panic (v1.3) --------- */
  autoServerName: { fa: 'خودکار — بهترین سرور', en: 'Auto — best server' },
  autoServerDesc: {
    fa: 'ناکسلو خودش سریع‌ترین سرور سالم را انتخاب می‌کند و در صورت قطعی، خودکار عوض می‌کند.',
    en: 'Naxlo picks the fastest healthy server itself and switches automatically if it fails.'
  },
  autoFailover: { fa: 'سوییچ خودکار در قطعی', en: 'Auto-switch on failure' },
  autoFailoverHint: {
    fa: 'اگر سرور فعال چند بار پیاپی پاسخ نداد، به بهترین سرور بعدی می‌رود.',
    en: 'If the active server fails several times in a row, Naxlo moves to the next best one.'
  },
  autoSwitchedToast: {
    fa: 'سرور قبلی پاسخ نداد؛ به «{name}» سوییچ شد',
    en: 'Previous server stopped answering — switched to “{name}”'
  },
  autoNoCandidates: {
    fa: 'سرور پشتیبانی‌شده‌ای برای انتخاب خودکار وجود ندارد',
    en: 'No supported server is available for auto selection'
  },
  autoPicked: { fa: 'انتخاب خودکار: {name}', en: 'Auto-picked: {name}' },

  pinServer: { fa: 'پین کردن سرور', en: 'Pin server' },
  unpinServer: { fa: 'برداشتن پین', en: 'Unpin server' },
  filterPinned: { fa: 'پین‌شده‌ها', en: 'Pinned' },
  filterCountryTitle: { fa: 'فیلتر بر اساس کشور', en: 'Filter by country' },

  panicTitle: { fa: 'قطع اضطراری', en: 'Panic disconnect' },
  panicHint: {
    fa: 'قطع فوری، بستن پروکسی سیستم و پاک‌کردن ردپا — بدون پرسش.',
    en: 'Instant disconnect, system proxy restored and traces cleared — no questions.'
  },
  panicDone: { fa: 'قطع اضطراری انجام شد', en: 'Panic disconnect completed' },
  panicHotkey: { fa: 'کلید اضطراری سراسری: Ctrl+Alt+Q', en: 'Global panic hotkey: Ctrl+Alt+Q' },

  logsHint: {
    fa: 'متن گزارش‌ها فنی و به زبان انگلیسی است؛ قالب و برچسب‌ها ترجمه شده‌اند.',
    en: 'Log payloads stay technical English; chrome and labels are translated.'
  },
  switchToLang: { fa: 'تغییر زبان به {name}', en: 'Switch language to {name}' },

  /* --------- multi-subscription, quota & speed --------- */
  subsList: { fa: 'اشتراک‌های شما', en: 'Your subscriptions' },
  subsListDesc: {
    fa: 'هر اشتراک جدا نگه داشته می‌شود؛ نام، حجم و تاریخ انقضا از خود سرویس خوانده می‌شود.',
    en: 'Each subscription is kept separately; its name, quota and expiry come from the service itself.'
  },
  subsAdd: { fa: 'افزودن اشتراک', en: 'Add subscription' },
  subsAddHint: {
    fa: 'لینک اشتراک را بچسبانید؛ اگر قبلاً ذخیره شده باشد فقط به‌روزرسانی می‌شود.',
    en: 'Paste a subscription link; if it is already stored it will only be refreshed.'
  },
  subsEmpty: { fa: 'هنوز اشتراکی اضافه نکرده‌اید', en: 'No subscriptions yet' },
  subsEmptyHint: {
    fa: 'لینک اشتراک را بالا بچسبانید یا یک فایل کانفیگ وارد کنید.',
    en: 'Paste a subscription link above or import a config file.'
  },
  subsCount: { fa: '{n} اشتراک', en: '{n} subscriptions' },
  subUnnamed: { fa: 'اشتراک بدون نام', en: 'Unnamed subscription' },
  subFromPanel: { fa: 'نام از سرور اشتراک', en: 'Name from the subscription panel' },
  subRefreshOne: { fa: 'به‌روزرسانی این اشتراک', en: 'Refresh this subscription' },
  subRemoveOne: { fa: 'حذف این اشتراک', en: 'Remove this subscription' },
  subRemoveTitle: { fa: 'حذف اشتراک؟', en: 'Remove subscription?' },
  subRemoveConfirm: {
    fa: 'همهٔ سرورهای این اشتراک حذف می‌شوند. اشتراک‌های دیگر دست‌نخورده می‌مانند.',
    en: 'All servers of this subscription are removed. Other subscriptions stay untouched.'
  },
  subRevealUrl: { fa: 'نمایش لینک کامل', en: 'Reveal full link' },
  subConfigs: { fa: '{total} کانفیگ · {supported} قابل اتصال', en: '{total} configs · {supported} connectable' },
  subUpdated: { fa: 'به‌روزرسانی: {when}', en: 'Updated {when}' },
  subNeverUpdated: { fa: 'هنوز دریافت نشده', en: 'Not fetched yet' },
  subFetching: { fa: 'در حال دریافت…', en: 'Fetching…' },
  subImportFile: { fa: 'وارد کردن فایل', en: 'Import file' },

  usageTitle: { fa: 'حجم اشتراک', en: 'Subscription quota' },
  usageUsed: { fa: 'مصرف‌شده', en: 'Used' },
  usageRemaining: { fa: 'باقی‌مانده', en: 'Remaining' },
  usageTotal: { fa: 'کل حجم', en: 'Total' },
  usageUnlimited: { fa: 'نامحدود', en: 'Unlimited' },
  usagePercent: { fa: '{p}٪ مصرف‌شده', en: '{p}% used' },
  usageExpire: { fa: 'انقضا', en: 'Expires' },
  usageNoExpiry: { fa: 'بدون انقضا', en: 'No expiry' },
  usageExpired: { fa: 'منقضی شده', en: 'Expired' },
  usageDaysLeft: { fa: '{n} روز مانده', en: '{n} days left' },
  usageNoQuota: {
    fa: 'سرور اشتراک اطلاعات حجم را گزارش نکرد',
    en: 'The panel did not report quota information'
  },

  speedTitle: { fa: 'سرعت', en: 'Speed' },
  speedRun: { fa: 'تست سرعت', en: 'Run speed test' },
  speedRunning: { fa: 'در حال اندازه‌گیری…', en: 'Measuring…' },
  speedHint: {
    fa: 'دانلود واقعی از طریق پروکسی فعال اندازه‌گیری می‌شود.',
    en: 'A real download is measured through the active proxy.'
  },
  speedNeedConnect: { fa: 'برای تست سرعت ابتدا متصل شوید', en: 'Connect first to run a speed test' },
  speedValue: { fa: '{n} مگابیت بر ثانیه', en: '{n} Mbps' },
  speedLatency: { fa: 'تأخیر', en: 'Latency' },

  groupManual: { fa: 'کانفیگ‌های دستی / وارد شده', en: 'Manual / imported configs' },
  groupOfSub: { fa: 'سرورهای این اشتراک', en: 'Servers of this subscription' },

  /* ---------------- settings ---------------- */
  settingsTitle: { fa: 'تنظیمات', en: 'Settings' },
  settingsDesc: { fa: 'پورت‌های پروکسی محلی، مسیریابی ترافیک، هستهٔ Xray و رفتار برنامه.', en: 'Local proxy ports, routing, the Xray core and app behaviour.' },
  localProxySection: { fa: 'پروکسی محلی', en: 'Local proxy' },
  localProxyDesc: { fa: 'ناکسلو فقط اینباند لوکال می‌سازد؛ هیچ درایور شبکه یا TUN نصب نمی‌شود.', en: 'Naxlo only creates loopback inbounds — no network driver or TUN is installed.' },
  socksPort: { fa: 'پورت SOCKS5', en: 'SOCKS5 port' },
  socksPortHint: { fa: 'برای مرورگرها و کلاینت‌های پشتیبان UDP', en: 'For browsers and UDP-capable clients' },
  httpPort: { fa: 'پورت HTTP', en: 'HTTP port' },
  httpPortHint: { fa: 'برای پروکسی سیستم ویندوز', en: 'For the Windows system proxy' },
  applySystemProxy: { fa: 'تنظیم خودکار پروکسی ویندوز', en: 'Set Windows proxy automatically' },
  applySystemProxyDesc: {
    fa: 'هنگام اتصال، پروکسی سیستم روی پورت HTTP تنظیم و هنگام قطع، تنظیمات قبلی بازگردانی می‌شود.',
    en: 'On connect the system proxy points at the HTTP port; previous settings are restored on disconnect.'
  },
  autoConnectLast: { fa: 'اتصال خودکار در شروع به کار ویندوز', en: 'Auto-connect when Windows starts' },
  autoConnectLastDesc: { fa: 'اگر برنامه با ورود به ویندوز اجرا شود، به آخرین سرور متصل می‌شود.', en: 'If launched at login, reconnect to the last server.' },
  routingSection: { fa: 'مسیریابی ترافیک', en: 'Traffic routing' },
  routeModeLabel: { fa: 'حالت مسیریابی', en: 'Routing mode' },
  routeAllProxy: { fa: 'همه از پروکسی', en: 'All through proxy' },
  routeAllProxyHint: { fa: 'تمام ترافیک (به‌جز لوکال‌هاست و شبکهٔ داخلی) از سرور عبور می‌کند.', en: 'All traffic (except loopback/LAN) goes through the server.' },
  routeIranDirect: { fa: 'سایت‌های ایران مستقیم', en: 'Iran direct' },
  routeIranDirectHint: { fa: 'دامنه‌ها و آی‌پی‌های ایرانی مستقیم و بقیه از پروکسی عبور می‌کنند.', en: 'Iranian domains/IPs go direct, everything else via proxy.' },
  routeLanDirect: { fa: 'شبکهٔ داخلی مستقیم', en: 'LAN direct' },
  routeLanDirectHint: { fa: 'فقط آدرس‌های خصوصی و لوکال مستقیم می‌شوند.', en: 'Only private and loopback addresses go direct.' },
  blockAds: { fa: 'مسدودسازی تبلیغات', en: 'Block ads' },
  blockAdsDesc: { fa: 'دامنه‌های دستهٔ تبلیغات (geosite) پیش از رسیدن به پروکسی مسدود می‌شوند.', en: 'Ad categories (geosite) are blocked before reaching the proxy.' },
  mux: { fa: 'مالتی‌پلکسینگ (Mux)', en: 'Multiplexing (Mux)' },
  muxDesc: { fa: 'چند جریان روی یک اتصال؛ می‌تواند تأخیر را کم کند اما گاهی پایداری را کاهش می‌دهد.', en: 'Multiple streams over one connection; may cut latency but can hurt stability.' },
  muxConcurrency: { fa: 'تعداد جریان هم‌زمان: {n}', en: 'Concurrent streams: {n}' },
  allowInsecure: { fa: 'اجازه به گواهی نامعتبر (allowInsecure)', en: 'Allow insecure certificates' },
  allowInsecureDesc: { fa: 'فقط اگر سرور شما گواهی خودامضا دارد. امنیت اتصال را کاهش می‌دهد.', en: 'Only for self-signed servers. Weakens connection security.' },
  testSection: { fa: 'تست اتصال', en: 'Connection test' },
  testSectionDesc: { fa: 'آدرسی که پس از برقراری پروکسی برای سنجش واقعی اتصال استفاده می‌شود.', en: 'URL used to verify real traffic after the proxy starts.' },
  testUrlLabel: { fa: 'آدرس تست', en: 'Test URL' },
  testUrlHint: { fa: 'پاسخ سریع و بدون محتوا بهترین گزینه است (مانند generate_204).', en: 'A fast empty response works best (e.g. generate_204).' },
  coreSection: { fa: 'هستهٔ Xray', en: 'Xray core' },
  coreStatus: { fa: 'وضعیت', en: 'Status' },
  coreReady: { fa: 'آماده', en: 'Ready' },
  coreMissing: { fa: 'نصب نشده', en: 'Not installed' },
  coreVersion: { fa: 'نسخه', en: 'Version' },
  coreSource: { fa: 'منبع', en: 'Source' },
  coreSourceBundled: { fa: 'همراه برنامه', en: 'Bundled' },
  coreSourceDownloaded: { fa: 'دانلود شده', en: 'Downloaded' },
  coreSourceCustom: { fa: 'فایل انتخابی شما', en: 'Your custom file' },
  coreSourceDev: { fa: 'محیط توسعه', en: 'Development' },
  corePath: { fa: 'مسیر', en: 'Path' },
  coreInstall: { fa: 'بازبینی و نصب هسته', en: 'Re-check & install core' },
  coreDownload: { fa: 'دانلود و نصب هسته', en: 'Download & install core' },
  corePickFile: { fa: 'انتخاب فایل اجرایی', en: 'Choose executable' },
  coreCheckUpdate: { fa: 'بررسی نسخهٔ جدید', en: 'Check for new version' },
  coreUpdateAvailable: { fa: 'نسخهٔ جدیدتر موجود است', en: 'A newer version is available' },
  coreUpToDate: { fa: 'هستهٔ شما به‌روز است', en: 'Your core is up to date' },
  coreUpdateBody: { fa: 'نسخهٔ فعلی {current} و آخرین نسخهٔ منتشرشده {latest} است.', en: 'Current {current}, latest published {latest}.' },
  coreErrorTitle: { fa: 'خطای هسته', en: 'Core error' },
  behaviourSection: { fa: 'رفتار و ظاهر', en: 'Behaviour & appearance' },
  autoStart: { fa: 'اجرا هنگام ورود به ویندوز', en: 'Launch at Windows login' },
  minimizeToTray: { fa: 'باقی ماندن در ناحیهٔ اعلان‌ها هنگام بستن پنجره', en: 'Keep running in the tray when the window closes' },
  minimizeToTrayDesc: { fa: 'اتصال شما با بستن پنجره قطع نمی‌شود.', en: 'Closing the window will not disconnect you.' },
  reduceMotion: { fa: 'کاهش انیمیشن‌ها', en: 'Reduce motion' },
  reduceMotionDesc: { fa: 'برای سیستم‌های ضعیف‌تر یا حساسیت به حرکت.', en: 'For weaker machines or motion sensitivity.' },
  languageField: { fa: 'زبان برنامه', en: 'App language' },
  languageFa: { fa: 'فارسی', en: 'Persian' },
  languageEn: { fa: 'انگلیسی', en: 'English' },
  languageTr: { fa: 'ترکی', en: 'Turkish' },
  accentField: { fa: 'رنگ تأکیدی', en: 'Accent colour' },
  logLevelField: { fa: 'سطح گزارش‌ها', en: 'Log level' },
  logError: { fa: 'فقط خطا', en: 'Errors' },
  logWarn: { fa: 'خطا و هشدار', en: 'Errors & warnings' },
  logInfo: { fa: 'معمولی', en: 'Normal' },
  logDebug: { fa: 'پرجزئیات', en: 'Verbose' },
  dangerSection: { fa: 'منطقهٔ خطر', en: 'Danger zone' },
  dangerDesc: { fa: 'حذف اشتراک، سرورها و تنظیمات از روی این دستگاه. اگر متصل هستید ابتدا اتصال قطع می‌شود.', en: 'Remove subscription, servers and settings from this device. Disconnects first if connected.' },
  wipeAction: { fa: 'پاک‌سازی کامل داده‌ها', en: 'Wipe all data' },
  wipeConfirmTitle: { fa: 'پاک‌سازی کامل داده‌ها؟', en: 'Wipe all data?' },
  wipeConfirmBody: {
    fa: 'لینک اشتراک، کانفیگ‌ها، سرور انتخاب‌شده و هستهٔ دانلودشده حذف می‌شوند. برای استفادهٔ دوباره باید اشتراک را وارد کنید.',
    en: 'The subscription link, configs, selected server and downloaded core are removed. You will need to add the subscription again.'
  },
  wipedToast: { fa: 'همهٔ داده‌ها پاک شد', en: 'All data wiped' },
  saveSettingsFailed: { fa: 'ذخیرهٔ تنظیمات ناموفق بود', en: 'Saving settings failed' },
  downloadingLabel: { fa: '{n}٪ دریافت شد', en: '{n}% downloaded' },
  connectingLabel: { fa: 'در حال اتصال به مخزن رسمی…', en: 'Contacting the official repository…' },

  /* ---------------- updates ---------------- */
  updateSection: { fa: 'به‌روزرسانی خودکار', en: 'Automatic updates' },
  updateSectionDesc: {
    fa: 'هنگام اجرای برنامه، گیت‌هاب بررسی می‌شود؛ نسخهٔ جدید به‌صورت بی‌صدا دانلود و با یک راه‌اندازی دوباره نصب می‌شود.',
    en: 'On launch Naxlo checks GitHub, downloads new releases silently and installs them with a single restart.'
  },
  autoUpdateToggle: { fa: 'بررسی و نصب خودکار در شروع برنامه', en: 'Check & install automatically on launch' },
  updateChecking: { fa: 'در حال بررسی به‌روزرسانی…', en: 'Checking for updates…' },
  updateDownloading: { fa: 'در حال دانلود نسخهٔ {v}…', en: 'Downloading {v}…' },
  updateReady: { fa: 'نسخهٔ {v} آمادهٔ نصب است', en: 'Version {v} is ready to install' },
  updateReadyBody: {
    fa: 'برنامه یک‌بار بسته شده و با نسخهٔ جدید اجرا می‌شود.',
    en: 'The app will close once and relaunch on the new version.'
  },
  installNow: { fa: 'هم‌اکنون نصب کن', en: 'Install now' },
  checkAppUpdate: { fa: 'بررسی نسخهٔ جدید برنامه', en: 'Check for app updates' },
  appUpdateAvailable: { fa: 'نسخهٔ جدید ناکسلو منتشر شد', en: 'A new Naxlo release is out' },
  appUpdateAvailableBody: { fa: 'نسخهٔ {v} در دسترس است', en: 'Version {v} is available' },
  appUpdateAutoBody: {
    fa: 'نسخهٔ {v} به‌صورت خودکار دانلود می‌شود؛ پس از آماده‌شدن، برنامه یک‌بار بسته و با نسخهٔ جدید اجرا می‌شود.',
    en: 'Version {v} is downloading automatically; Naxlo will restart once to install it.'
  },
  appUpToDate: { fa: 'ناکسلو به‌روز است', en: 'Naxlo is up to date' },
  appUpToDateBody: { fa: 'نسخهٔ نصب‌شده: {v}', en: 'Installed version: {v}' },
  updateCheckFailed: { fa: 'بررسی به‌روزرسانی ناموفق بود', en: 'Update check failed' },
  releasePage: { fa: 'صفحهٔ ریلیز', en: 'Release page' },
  devBuildNote: { fa: 'به‌روزرسانی خودکار فقط در نسخهٔ نصب‌شده فعال است.', en: 'Auto-update only runs in packaged builds.' },

  /* ---------------- logs ---------------- */
  logsTitle: { fa: 'گزارش‌ها', en: 'Logs' },
  logsDesc: { fa: 'رویدادهای برنامه و خروجی هستهٔ Xray — همهٔ مقادیر حساس پیش از ذخیره پوشانده شده‌اند.', en: 'App events and Xray core output — sensitive values are masked before storage.' },
  copyAll: { fa: 'کپی همه', en: 'Copy all' },
  clearLogs: { fa: 'پاک کردن', en: 'Clear' },
  logsCopied: { fa: 'گزارش‌ها کپی شد', en: 'Logs copied' },
  levelAll: { fa: 'همه', en: 'All' },
  levelCore: { fa: 'خروجی هسته', en: 'Core output' },
  levelInfo: { fa: 'اطلاع', en: 'Info' },
  levelWarn: { fa: 'هشدار', en: 'Warning' },
  levelError: { fa: 'خطا', en: 'Error' },
  autoScroll: { fa: 'پیمایش خودکار', en: 'Auto scroll' },
  logsNotice: {
    fa: 'هیچ لینک اشتراک، کلید، شناسهٔ کاربری یا آدرس سروری در این گزارش‌ها نوشته نمی‌شود؛ مقادیر حساس با [redacted] جایگزین می‌شوند.',
    en: 'No subscription link, key, user id or server address is ever written here — sensitive values become [redacted].'
  },
  noLogs: { fa: 'گزارشی برای نمایش نیست', en: 'Nothing to show yet' },

  /* ---------------- about ---------------- */
  aboutTitle: { fa: 'دربارهٔ ناکسلو', en: 'About Naxlo' },
  aboutDesc: { fa: 'کلاینت سبک و فارسی‌زبان VLESS برای ویندوز، بدون TUN و بدون درایور.', en: 'A light Persian client for VLESS on Windows — no TUN, no drivers.' },
  aboutElectron: { fa: 'Electron', en: 'Electron' },
  aboutPlatform: { fa: 'سکوی اجرا', en: 'Platform' },
  aboutProtection: { fa: 'محافظت از خزانه', en: 'Vault protection' },
  protectionSafe: { fa: 'DPAPI ویندوز (کلید سیستمی)', en: 'Windows DPAPI (system key)' },
  protectionAes: { fa: 'AES-256-GCM با کلید مشتق از دستگاه', en: 'AES-256-GCM with a device-derived key' },
  protectionNone: { fa: 'در دسترس نیست — داده‌ها ذخیره نمی‌شوند', en: 'Unavailable — nothing is stored' },
  aboutDataDir: { fa: 'پوشهٔ داده', en: 'Data folder' },
  copyDataDir: { fa: 'کپی مسیر داده‌ها', en: 'Copy data path' },
  dataDirCopied: { fa: 'مسیر پوشهٔ داده کپی شد', en: 'Data folder path copied' },
  securityTitle: { fa: 'امنیت و حریم خصوصی', en: 'Security & privacy' },
  security1: { fa: 'لینک اشتراک و کلیدها فقط در خزانهٔ رمزنگاری‌شدهٔ کاربر (DPAPI) ذخیره می‌شوند.', en: 'Subscription links and keys live only in the user’s encrypted vault (DPAPI).' },
  security2: { fa: 'هیچ مقدار حساسی در کنسول، فایل گزارش یا رابط کاربری نوشته نمی‌شود؛ همه‌جا پوشیده است.', en: 'No sensitive value reaches the console, log file or UI — everything is masked.' },
  security3: { fa: 'کانفیگ Xray در فایلی با دسترسی ۰۶۰۰ نوشته و پس از خاموش‌شدن هسته حذف می‌شود.', en: 'The Xray config is written 0600 and deleted once the core exits.' },
  security4: { fa: 'پروکسی سیستم ویندوز پیش از تغییر پشتیبان‌گیری و هنگام قطع بازگردانی می‌شود.', en: 'Windows proxy settings are backed up before change and restored on disconnect.' },
  security5: { fa: 'بدون TUN، بدون Wintun، بدون سرویس سیستمی و بدون دسترسی مدیریتی.', en: 'No TUN, no Wintun, no system service, no admin rights.' },
  security6: { fa: 'هستهٔ Xray از مخزن رسمی دانلود و با SHA-512 منتشرشده اعتبارسنجی می‌شود.', en: 'The Xray core is downloaded from the official repo and verified with SHA-512.' },
  linksTitle: { fa: 'پیوندها', en: 'Links' },
  linkRepo: { fa: 'مخزن پروژه در گیت‌هاب', en: 'Project repository on GitHub' },
  linkXray: { fa: 'هستهٔ Xray-core', en: 'Xray-core' },
  linkFont: { fa: 'قلم وزیرمتن', en: 'Vazirmatn font' },
  linkElectron: { fa: 'مستندات Electron', en: 'Electron docs' },
  licenseTitle: { fa: 'پروانه', en: 'License' },
  licenseBody: {
    fa: 'ناکسلو با پروانهٔ MIT منتشر می‌شود. هستهٔ Xray با پروانهٔ MPL-2.0 و قلم وزیرمتن با پروانهٔ OFL عرضه می‌شوند. این برنامه هیچ وابستگی به سرویس یا شرکت خاصی ندارد.',
    en: 'Naxlo is MIT licensed. Xray core is MPL-2.0 and the Vazirmatn font is OFL. The app has no dependency on any service or company.'
  },

  /* ---------------- status bar ---------------- */
  statusProxyOn: { fa: 'پروکسی سیستم فعال است', en: 'System proxy active' },
  statusProxyOff: { fa: 'پروکسی سیستم اعمال نشده', en: 'System proxy not applied' },
  statusCore: { fa: 'هسته:', en: 'Core:' },
  statusCoreMissing: { fa: 'نصب نشده', en: 'not installed' },

  /* ---------------- misc ---------------- */
  boot: { fa: 'در حال آماده‌سازی ناکسلو…', en: 'Preparing Naxlo…' },
  reveal: { fa: 'نمایش مقدار واقعی', en: 'Reveal real value' },
  hide: { fa: 'پنهان کردن', en: 'Hide' }
} as const

interface I18nShape {
  lang: Lang
  dir: 'rtl' | 'ltr'
  t: (key: MsgKey, vars?: Record<string, string | number>) => string
  pick: (value: string | LString | null | undefined) => string
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nShape | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { settings, saveSettings } = useStore()
  const lang: Lang = settings.language === 'en' || settings.language === 'tr' ? settings.language : 'fa'

  useEffect(() => {
    setFormatLocale(lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
  }, [lang])

  const t = useCallback(
    (key: MsgKey, vars?: Record<string, string | number>): string => {
      let text: string = lang === 'tr' ? (TR[key] ?? MESSAGES[key].en) : MESSAGES[key][lang]
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value))
        }
      }
      return text
    },
    [lang]
  )

  const pick = useCallback((value: string | LString | null | undefined): string => {
    if (value === null || value === undefined) return ''
    if (isLString(value)) return lang === 'tr' ? value.en : value[lang]
    return value
  }, [lang])

  const setLang = useCallback(
    (next: Lang) => {
      void saveSettings({ language: next })
    },
    [saveSettings]
  )

  const value = useMemo<I18nShape>(() => ({ lang, dir: lang === 'fa' ? 'rtl' : 'ltr', t, pick, setLang }), [lang, t, pick, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nShape {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
