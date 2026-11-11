/**
 * Xray configuration builder.
 *
 * Two connection modes:
 *   - proxy (default): local SOCKS5 + HTTP inbounds only — no driver, no
 *     privileged networking; Windows uses them through the system proxy.
 *   - tun: Xray's built-in TUN inbound (Wintun on Windows) routes the whole
 *     system through the tunnel, including apps that ignore the proxy. It
 *     needs a one-time elevated relaunch and the official wintun.dll.
 */
import type { RouteMode, ServerConfig, Settings } from '../../../shared/types'
import { L, type LString } from '../../../shared/i18n'

export interface BuildOptions {
  server: ServerConfig
  settings: Settings
  /** Directory holding geoip.dat / geosite.dat (passed via XRAY_LOCATION_ASSET). */
  geoDir?: string | null
}

type Json = Record<string, unknown>

export function buildXrayConfig({ server, settings }: BuildOptions): Json {
  const listen = settings.listenAddress || '127.0.0.1'

  const inbounds: Json[] = [
    {
      tag: 'naxlo-socks',
      listen,
      port: settings.socksPort,
      protocol: 'socks',
      settings: {
        auth: 'noauth',
        udp: true,
        ip: listen,
        userLevel: 8
      },
      sniffing: {
        enabled: true,
        destOverride: ['http', 'tls', 'quic'],
        metadataOnly: false,
        routeOnly: false
      }
    },
    {
      tag: 'naxlo-http',
      listen,
      port: settings.httpPort,
      protocol: 'http',
      settings: {
        timeout: 360,
        userLevel: 8
      },
      sniffing: {
        enabled: true,
        destOverride: ['http', 'tls', 'quic'],
        metadataOnly: false
      }
    }
  ]

  if (settings.connectionMode === 'tun') {
    // System-wide tunnel via Xray's built-in TUN inbound (Wintun adapter).
    // IPv4-only on purpose: on systems with IPv6 disabled, IPv6 routes here
    // would stop the adapter from starting.
    const tunSettings: Json = {
      name: 'naxlo',
      desc: 'Naxlo',
      mtu: 1500,
      gateway: ['10.213.0.1/24'],
      dns: ['1.1.1.1', '8.8.8.8'],
      autoSystemRoutingTable: ['0.0.0.0/0'],
      autoOutboundsInterface: 'auto'
    }
    if (process.platform === 'win32') {
      // WFP filters keep the system's DNS (udp/tcp 53, the Windows DNS Client
      // service, DoT/DoQ) inside the tunnel — without them name resolution
      // silently bypasses the tunnel. Requires `dns` on the adapter (set above).
      tunSettings.autoSystemWfpBlockLeak = ['dns']
    }
    inbounds.unshift({
      tag: 'naxlo-tun',
      port: 0,
      protocol: 'tun',
      settings: tunSettings,
      sniffing: {
        enabled: true,
        destOverride: ['http', 'tls', 'quic'],
        metadataOnly: false
      }
    })
  }

  const outbounds: Json[] = [buildOutbound(server, settings), directOutbound(), blockOutbound()]

  if (settings.connectionMode === 'tun') {
    // In-TUN DNS: the WFP leak filters push every system query into the
    // tunnel, so without a DNS path of our own those queries would ride the
    // catch-all rule to the server's UDP forwarder — which many servers
    // silently drop, leaving the tunnel "connected but dead". A `dns`
    // outbound answers them inside Xray instead, resolving over DoH that
    // travels through the proxy (encrypted, no cleartext leak).
    // UseIPv4 also keeps AAAA answers away from the IPv4-only adapter, which
    // otherwise stalls connections that try the (unreachable) IPv6 route.
    outbounds.splice(1, 0, { tag: 'naxlo-dns', protocol: 'dns' })
  }

  return {
    log: {
      // Access logs would contain destinations; keep them off and stay quiet.
      access: '',
      error: '',
      loglevel: settings.xrayLogLevel === 'none' ? 'none' : settings.xrayLogLevel,
      dnsLog: false,
      maskAddress: 'quarter'
    },
    dns:
      settings.connectionMode === 'tun'
        ? {
            tag: 'naxlo-dns-resolver',
            queryStrategy: 'UseIPv4',
            servers: [
              // Literal-IP DoH: no bootstrap resolution, no loop. Routed via
              // the proxy outbound, so queries stay inside the tunnel.
              'https://1.1.1.1/dns-query',
              'https://8.8.8.8/dns-query',
              // Last-resort plain query if DoH is blocked outright.
              '1.1.1.1'
            ]
          }
        : undefined,
    inbounds,
    outbounds,
    routing: buildRouting(settings.routeMode, settings.blockAds, settings.connectionMode === 'tun'),
    policy: {
      levels: {
        '8': {
          handshake: 4,
          connIdle: 300,
          uplinkOnly: 1,
          downlinkOnly: 1,
          statsUserUplink: false,
          statsUserDownlink: false,
          bufferSize: 10240
        }
      },
      system: {
        statsInboundUplink: false,
        statsInboundDownlink: false,
        statsOutboundUplink: false,
        statsOutboundDownlink: false
      }
    }
  }
}

function buildOutbound(server: ServerConfig, settings: Settings): Json {
  const streamSettings = buildStreamSettings(server, settings)
  const outbound: Json = {
    tag: 'naxlo-proxy',
    protocol: server.protocol === 'trojan' ? 'trojan' : server.protocol === 'vmess' ? 'vmess' : 'vless',
    settings: buildProtocolSettings(server),
    streamSettings,
    mux: buildMux(server, settings)
  }
  return outbound
}

function buildProtocolSettings(server: ServerConfig): Json {
  if (server.protocol === 'trojan') {
    return {
      servers: [
        {
          address: server.address,
          port: server.port,
          password: server.credential,
          level: 8
        }
      ]
    }
  }
  if (server.protocol === 'vmess') {
    return {
      vnext: [
        {
          address: server.address,
          port: server.port,
          users: [
            {
              id: server.credential,
              security: server.encryption || 'auto',
              level: 8,
              alterations: 0
            }
          ]
        }
      ]
    }
  }
  return {
    vnext: [
      {
        address: server.address,
        port: server.port,
        users: [
          {
            id: server.credential,
            level: 8,
            flow: server.flow || '',
            encryption: server.encryption || 'none'
          }
        ]
      }
    ]
  }
}

function buildMux(server: ServerConfig, settings: Settings): Json {
  const enabled = server.mux ?? settings.muxEnabled
  if (!enabled) return { enabled: false, concurrency: -1 }
  const concurrency = server.muxConcurrency ?? settings.muxConcurrency ?? 8
  // xUDP needs mux for VLESS in most setups.
  return { enabled: true, concurrency: Math.max(1, Math.min(128, concurrency)), xudpConcurrency: concurrency }
}

function buildStreamSettings(server: ServerConfig, settings: Settings): Json {
  const stream: Json = {
    network: server.network === 'unknown' ? 'tcp' : server.network,
    security: server.security,
    sockopt: {
      tcpFastOpen: false,
      tcpNoDelay: true,
      tcpKeepAliveInterval: 20,
      tcpMptcp: false,
      tcpUserTimeout: 10000
    }
  }

  const allowInsecure = Boolean(server.allowInsecure ?? settings.allowInsecure)

  if (server.security === 'tls') {
    stream.tlsSettings = {
      serverName: server.sni || server.address,
      alpn: server.alpn && server.alpn.length ? server.alpn : ['h2', 'http/1.1'],
      fingerprint: server.fingerprint || 'chrome',
      allowInsecure,
      show: false,
      disableSystemRoot: false,
      rejectUnknownSni: false
    }
  } else if (server.security === 'reality') {
    stream.realitySettings = {
      serverName: server.sni || server.address,
      fingerprint: server.fingerprint || 'chrome',
      show: false,
      publicKey: server.pbk,
      shortId: server.sid ?? '',
      spiderX: server.spiderX ?? '/'
    }
  } else if (server.security === 'xtls') {
    stream.xtlsSettings = {
      serverName: server.sni || server.address,
      alpn: server.alpn && server.alpn.length ? server.alpn : ['h2', 'http/1.1'],
      allowInsecure,
      fingerprint: server.fingerprint || 'chrome'
    }
  }

  switch (server.network) {
    case 'tcp':
      stream.tcpSettings = {
        acceptProxyProtocol: false,
        header: { type: server.headerType && server.headerType !== 'none' ? server.headerType : 'none' }
      }
      break
    case 'ws':
      stream.wsSettings = {
        acceptProxyProtocol: false,
        path: server.path || '/',
        headers: server.host ? { Host: server.host } : undefined
      }
      break
    case 'grpc':
      stream.grpcSettings = {
        authority: server.sni || server.host || '',
        serviceName: server.serviceName || '',
        multiMode: Boolean(server.grpcMultiMode),
        idleTimeout: 60,
        healthCheckTimeout: 20,
        permitWithoutStream: false,
        initialWindowSize: 65536
      }
      break
    case 'h2':
      stream.httpSettings = {
        path: server.path || '/',
        host: server.host ? [server.host] : [],
        method: 'PUT',
        headers: {}
      }
      break
    case 'quic':
      stream.quicSettings = {
        security: server.quicSecurity || 'none',
        key: server.quicKey || '',
        header: { type: server.headerType || 'none' }
      }
      break
    case 'kcp':
      stream.kcpSettings = {
        mtu: 1350,
        tti: 20,
        uplinkCapacity: 5,
        downlinkCapacity: 20,
        congestion: false,
        readBufferSize: 1,
        writeBufferSize: 1,
        header: { type: server.headerType || 'none' },
        seed: server.path || undefined
      }
      break
    case 'splithttp':
      stream.splithttpSettings = {
        path: server.path || '/',
        host: server.host || server.sni || ''
      }
      break
    case 'xhttp':
      stream.xhttpSettings = {
        host: server.host || server.sni || '',
        path: server.path || '/',
        mode: server.xhttpMode || 'auto',
        keepAlivePeriod: 40
      }
      break
    default:
      stream.tcpSettings = { header: { type: 'none' } }
  }

  return stream
}

function directOutbound(): Json {
  return {
    tag: 'naxlo-direct',
    protocol: 'freedom',
    settings: {
      domainStrategy: 'AsIs',
      redirect: '',
      userLevel: 8
    }
  }
}

function blockOutbound(): Json {
  return {
    tag: 'naxlo-block',
    protocol: 'blackhole',
    settings: {
      response: { type: 'http' }
    }
  }
}

function buildRouting(mode: RouteMode, blockAds: boolean, tun = false): Json {
  const rules: Json[] = []

  if (tun) {
    // Wire-format DNS arriving from the tunnel is answered by our own `dns`
    // outbound (see buildXrayConfig) instead of being shipped to the server's
    // UDP forwarder. Must precede every domain/rule based match.
    rules.push({
      type: 'field',
      inboundTag: ['naxlo-tun'],
      port: 53,
      outboundTag: 'naxlo-dns'
    })
  }

  if (blockAds) {
    rules.push({
      type: 'field',
      outboundTag: 'naxlo-block',
      domain: ['geosite:category-ads-all']
    })
  }

  // Never proxy loopback / private ranges — this is what keeps the app safe
  // without a TUN adapter.
  const privateRule: Json = {
    type: 'field',
    outboundTag: 'naxlo-direct',
    ip: ['geoip:private'],
    domain: ['geosite:private', 'localhost']
  }
  rules.push(privateRule)

  if (mode === 'iran-direct') {
    rules.push({
      type: 'field',
      outboundTag: 'naxlo-direct',
      domain: ['geosite:ir', 'regexp:.*\\.ir$'],
      ip: ['geoip:ir']
    })
  }

  rules.push({
    type: 'field',
    outboundTag: 'naxlo-proxy',
    network: 'tcp,udp'
  })

  return {
    domainStrategy: 'AsIs',
    domainMatcher: 'mph',
    rules
  }
}

/**
 * Validate the built object before handing it to Xray: a config with a missing
 * REALITY key or an empty address would otherwise fail with an opaque error.
 */
export function validateConfig(server: ServerConfig): LString | null {
  if (!server.supported) {
    const reason = server.unsupportedReason
    // Vaults written before 1.15.2 stored a plain Persian sentence.
    if (typeof reason === 'string') return L(reason, reason)
    return reason ?? L('این کانفیگ پشتیبانی نمی‌شود', 'This config is not supported')
  }
  if (!server.address) return L('آدرس سرور خالی است', 'Server address is empty')
  if (!server.port) return L('پورت سرور معتبر نیست', 'Server port is invalid')
  if (!server.credential) return L('کلید/رمز کانفیگ خالی است', 'Config credential is empty')
  if (server.security === 'reality' && !server.pbk) return L('کلید عمومی REALITY موجود نیست', 'REALITY public key is missing')
  if (server.network === 'grpc' && !server.serviceName) return L('serviceName برای gRPC موجود نیست', 'serviceName is missing for gRPC')
  return null
}
