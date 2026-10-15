/**
 * Naxlo — shared contracts between main, preload and renderer.
 *
 * SECURITY NOTE
 * -------------
 * Nothing in this file may ever carry a raw secret into a log line. The types
 * below intentionally describe *masked* views of sensitive values; the raw
 * subscription URL, UUIDs, private keys and short IDs live only inside the
 * encrypted store in the main process (see `src/main/lib/secretStore.ts`).
 */

export const APP_NAME = 'naxlo'

export type Protocol = 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'unknown'
export type SecurityType = 'none' | 'tls' | 'reality' | 'xtls'
export type NetworkType =
  | 'tcp'
  | 'ws'
  | 'grpc'
  | 'h2'
  | 'quic'
  | 'kcp'
  | 'splithttp'
  | 'xhttp'
  | 'unknown'

/** A parsed proxy configuration. Secrets are stored but never logged. */
export interface ServerConfig {
  /** Stable identifier: sha256(protocol|address|port|credential) truncated. */
  id: string
  name: string
  protocol: Protocol
  /** Whether Naxlo knows how to build an Xray outbound for it. */
  supported: boolean
  /** Human readable reason when `supported` is false. */
  unsupportedReason?: string
  address: string
  port: number
  /** UUID (vless/vmess) or password (trojan/ss). Sensitive. */
  credential: string
  flow?: string
  encryption?: string
  security: SecurityType
  network: NetworkType
  sni?: string
  alpn?: string[]
  fingerprint?: string
  allowInsecure?: boolean
  /** REALITY public key. Sensitive. */
  pbk?: string
  /** REALITY short id. Sensitive. */
  sid?: string
  spiderX?: string
  /** Transport options */
  host?: string
  path?: string
  serviceName?: string
  grpcMultiMode?: boolean
  headerType?: string
  quicSecurity?: string
  quicKey?: string
  xhttpMode?: string
  /** Multiplexing */
  mux?: boolean
  muxConcurrency?: number
  /** Metadata */
  addedAt: number
  source: 'subscription' | 'manual' | 'import'
  latencyMs: number | null
  latencyAt: number | null
  /** Original link, kept only inside the encrypted store. Never sent to logs. */
  raw?: string
}

/** The shape handed to the renderer: secrets are masked unless revealed. */
export interface ServerView extends Omit<ServerConfig, 'credential' | 'pbk' | 'sid' | 'raw' | 'address'> {
  credentialMasked: string
  pbkMasked?: string
  sidMasked?: string
  addressMasked: string
  /** Full address, only present when the user explicitly revealed secrets. */
  address?: string
  /** Revealed secrets, only present when the user explicitly asked for them. */
  credential?: string
  pbk?: string
  sid?: string
  raw?: string
}

export type ConnectionState =
  | 'idle'
  | 'preparing'
  | 'starting'
  | 'connected'
  | 'stopping'
  | 'error'
  | 'core-missing'

export type RouteMode = 'all-proxy' | 'iran-direct' | 'lan-direct'

export interface CoreStatus {
  ready: boolean
  /** Resolved absolute path of the executable (never contains secrets). */
  path: string | null
  version: string | null
  source: 'bundled' | 'downloaded' | 'custom' | 'dev' | null
  downloading: boolean
  progress: number | null
  error: string | null
}

export interface SubscriptionInfo {
  hasUrl: boolean
  /** e.g. `https://exa••••••••••.com/sub/ab••••••` */
  maskedUrl: string
  lastUpdated: number | null
  lastError: string | null
  totalConfigs: number
  supportedConfigs: number
  autoRefreshMinutes: number
  fetching: boolean
}

export interface PublicIdentity {
  ip: string
  country?: string
  countryCode?: string
  city?: string
  asn?: string
  checkedAt: number
}

export interface AppState {
  connection: ConnectionState
  /** Bumped whenever the server list changes, so the renderer can refetch. */
  serversRevision: number
  /** The server chosen in the list (vault selection). */
  selectedServerId: string | null
  activeServerId: string | null
  activeServerName: string | null
  activeServerAddressMasked: string | null
  socksPort: number
  httpPort: number
  systemProxyEnabled: boolean
  systemProxyApplied: boolean
  startedAt: number | null
  lastError: string | null
  latencyMs: number | null
  identity: PublicIdentity | null
  core: CoreStatus
  subscription: SubscriptionInfo
}

export interface Settings {
  socksPort: number
  httpPort: number
  listenAddress: string
  applySystemProxy: boolean
  routeMode: RouteMode
  blockAds: boolean
  muxEnabled: boolean
  muxConcurrency: number
  allowInsecure: boolean
  testUrl: string
  autoStart: boolean
  autoRefreshMinutes: number
  autoConnectLast: boolean
  minimizeToTray: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  accent: 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose'
  reduceMotion: boolean
  corePath: string | null
  xrayLogLevel: 'none' | 'error' | 'warning'
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'core'

export interface LogEntry {
  id: number
  at: number
  level: LogLevel
  scope: string
  message: string
}

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
}

/** IPC channel names — kept in one place so main/preload/renderer stay in sync. */
export const IPC = {
  stateGet: 'naxlo:state:get',
  stateChanged: 'naxlo:state:changed',
  serversList: 'naxlo:servers:list',
  serversSelect: 'naxlo:servers:select',
  serversReveal: 'naxlo:servers:reveal',
  serversRemove: 'naxlo:servers:remove',
  serversClear: 'naxlo:servers:clear',
  serversTest: 'naxlo:servers:test',
  serversTestAll: 'naxlo:servers:test-all',
  serversLatency: 'naxlo:servers:latency',
  subscriptionSave: 'naxlo:subscription:save',
  subscriptionReveal: 'naxlo:subscription:reveal',
  subscriptionRefresh: 'naxlo:subscription:refresh',
  subscriptionClear: 'naxlo:subscription:clear',
  subscriptionImportFile: 'naxlo:subscription:import-file',
  connect: 'naxlo:connect',
  disconnect: 'naxlo:disconnect',
  settingsGet: 'naxlo:settings:get',
  settingsSet: 'naxlo:settings:set',
  coreEnsure: 'naxlo:core:ensure',
  corePick: 'naxlo:core:pick',
  coreCheckUpdate: 'naxlo:core:check-update',
  logsGet: 'naxlo:logs:get',
  logsClear: 'naxlo:logs:clear',
  logsChanged: 'naxlo:logs:changed',
  toast: 'naxlo:toast',
  windowMinimize: 'naxlo:window:minimize',
  windowMaximize: 'naxlo:window:maximize',
  windowClose: 'naxlo:window:close',
  shellOpen: 'naxlo:shell:open',
  clipboardWrite: 'naxlo:clipboard:write',
  appInfo: 'naxlo:app:info',
  appUpdate: 'naxlo:app:update'
} as const

export const DEFAULT_SETTINGS: Settings = {
  socksPort: 10808,
  httpPort: 10809,
  listenAddress: '127.0.0.1',
  applySystemProxy: true,
  routeMode: 'all-proxy',
  blockAds: false,
  muxEnabled: false,
  muxConcurrency: 8,
  allowInsecure: false,
  testUrl: 'https://www.gstatic.com/generate_204',
  autoStart: false,
  autoRefreshMinutes: 0,
  autoConnectLast: false,
  minimizeToTray: true,
  logLevel: 'info',
  accent: 'cyan',
  reduceMotion: false,
  corePath: null,
  xrayLogLevel: 'warning'
}

export const PINNED_XRAY_VERSION = 'v26.3.27'

export const isWindows = typeof process !== 'undefined' && process.platform === 'win32'
