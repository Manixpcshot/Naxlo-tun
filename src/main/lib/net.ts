/**
 * Network probes.
 *
 * Dependency-free: raw TCP for reachability and a hand-rolled HTTP/CONNECT
 * client so Naxlo can verify that traffic really flows through the local Xray
 * inbound (Node's built-in fetch cannot be pointed at an HTTP proxy without
 * extra packages).
 */
import http from 'node:http'
import net from 'node:net'
import tls from 'node:tls'
import { performance } from 'node:perf_hooks'
import { log } from './logger'
import type { PublicIdentity } from '../../shared/types'

const SCOPE = 'net'

export interface ProbeResult {
  ok: boolean
  status: number
  ms: number
  error?: string
}

/** TCP handshake time — a cheap reachability/RTT estimate for a server. */
export function tcpPing(address: string, port: number, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false
    const started = performance.now()
    const socket = new net.Socket()
    const finish = (value: number | null): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(Math.round(performance.now() - started)))
    socket.once('timeout', () => finish(null))
    socket.once('error', () => finish(null))
    try {
      socket.connect(port, address)
    } catch {
      finish(null)
    }
  })
}

/** Issue an HTTP(S) request through the local HTTP inbound. */
export function requestThroughProxy(
  proxyHost: string,
  proxyPort: number,
  targetUrl: string,
  timeoutMs = 12000
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let url: URL
    try {
      url = new URL(targetUrl)
    } catch {
      resolve({ ok: false, status: 0, ms: 0, error: 'آدرس نامعتبر برای تست اتصال' })
      return
    }
    const started = performance.now()
    let settled = false
    const finish = (result: ProbeResult): void => {
      if (settled) return
      settled = true
      resolve({ ...result, ms: Math.round(performance.now() - started) })
    }

    const timer = setTimeout(() => {
      finish({ ok: false, status: 0, ms: 0, error: 'مهلت تست اتصال تمام شد' })
    }, timeoutMs)

    const cleanup = (): void => clearTimeout(timer)

    if (url.protocol === 'http:') {
      const req = http.request(
        {
          host: proxyHost,
          port: proxyPort,
          method: 'GET',
          path: targetUrl,
          headers: { Host: url.host, 'User-Agent': 'naxlo/1.0', Connection: 'close' }
        },
        (res) => {
          res.resume()
          const status = res.statusCode ?? 0
          cleanup()
          finish({ ok: status >= 200 && status < 400, status, ms: 0 })
        }
      )
      req.on('error', (err) => {
        cleanup()
        finish({ ok: false, status: 0, ms: 0, error: err.message })
      })
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('timeout'))
      })
      req.end()
      return
    }

    // HTTPS → CONNECT tunnel, then TLS on top of it.
    const connectReq = http.request({
      host: proxyHost,
      port: proxyPort,
      method: 'CONNECT',
      path: `${url.hostname}:${url.port || 443}`
    })

    connectReq.on('error', (err) => {
      cleanup()
      finish({ ok: false, status: 0, ms: 0, error: err.message })
    })
    connectReq.setTimeout(timeoutMs, () => connectReq.destroy(new Error('timeout')))

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy()
        cleanup()
        finish({
          ok: false,
          status: res.statusCode ?? 0,
          ms: 0,
          error: `تونل پروکسی برقرار نشد (${res.statusCode ?? 'بدون کد'})`
        })
        return
      }
      const secure = tls.connect(
        {
          socket,
          servername: url.hostname,
          ALPNProtocols: ['http/1.1'],
          rejectUnauthorized: true
        },
        () => {
          secure.write(
            [
              `GET ${url.pathname}${url.search} HTTP/1.1`,
              `Host: ${url.host}`,
              'User-Agent: naxlo/1.0',
              'Accept: */*',
              'Connection: close',
              '',
              ''
            ].join('\r\n')
          )
        }
      )
      secure.on('error', (err) => {
        secure.destroy()
        socket.destroy()
        cleanup()
        finish({ ok: false, status: 0, ms: 0, error: err.message })
      })
      secure.once('data', (chunk) => {
        const head = chunk.toString('utf8').split('\r\n')[0] ?? ''
        const match = /HTTP\/1\.\d\s+(\d{3})/.exec(head)
        const status = match ? Number(match[1]) : 0
        secure.destroy()
        socket.destroy()
        cleanup()
        finish({ ok: status >= 200 && status < 400, status, ms: 0 })
      })
    })
    connectReq.end()
  })
}

/** Wait until a local TCP port accepts connections (Xray inbound is up). */
export function waitForPort(host: string, port: number, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const attempt = (): void => {
      const socket = new net.Socket()
      socket.setTimeout(600)
      const done = (ok: boolean): void => {
        socket.destroy()
        if (ok) resolve(true)
        else if (Date.now() > deadline) resolve(false)
        else setTimeout(attempt, 180)
      }
      socket.once('connect', () => done(true))
      socket.once('timeout', () => done(false))
      socket.once('error', () => done(false))
      socket.connect(port, host)
    }
    attempt()
  })
}

const IDENTITY_PROVIDERS = [
  {
    url: 'https://ipwho.is/',
    parse: (data: any): PublicIdentity | null =>
      data && data.ip
        ? {
            ip: String(data.ip),
            country: data.country ? String(data.country) : undefined,
            countryCode: data.country_code ? String(data.country_code) : undefined,
            city: data.city ? String(data.city) : undefined,
            asn: data.connection?.org ? String(data.connection.org) : undefined,
            checkedAt: Date.now()
          }
        : null
  },
  {
    url: 'https://freeipapi.com/api/json',
    parse: (data: any): PublicIdentity | null =>
      data && (data.ipAddress || data.ip)
        ? {
            ip: String(data.ipAddress ?? data.ip),
            country: data.countryName ? String(data.countryName) : undefined,
            city: data.cityName ? String(data.cityName) : undefined,
            checkedAt: Date.now()
          }
        : null
  },
  {
    url: 'https://api.ipify.org?format=json',
    parse: (data: any): PublicIdentity | null =>
      data && data.ip ? { ip: String(data.ip), checkedAt: Date.now() } : null
  }
]

/** Resolve the public identity as seen *through* the proxy. */
export async function fetchIdentityThroughProxy(
  proxyHost: string,
  proxyPort: number,
  timeoutMs = 10000
): Promise<PublicIdentity | null> {
  for (const provider of IDENTITY_PROVIDERS) {
    const data = await fetchThroughProxyJson(proxyHost, proxyPort, provider.url, timeoutMs)
    if (!data) continue
    const identity = provider.parse(data)
    if (identity) {
      log.info(SCOPE, `identity resolved via ${new URL(provider.url).hostname}`)
      return identity
    }
  }
  return null
}

function fetchThroughProxyJson(
  proxyHost: string,
  proxyPort: number,
  url: string,
  timeoutMs: number
): Promise<any | null> {
  return new Promise((resolve) => {
    const target = new URL(url)
    const connectReq = http.request({
      host: proxyHost,
      port: proxyPort,
      method: 'CONNECT',
      path: `${target.hostname}:${target.port || 443}`
    })
    const timer = setTimeout(() => {
      connectReq.destroy(new Error('timeout'))
      resolve(null)
    }, timeoutMs)

    connectReq.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy()
        clearTimeout(timer)
        resolve(null)
        return
      }
      const secure = tls.connect({ socket, servername: target.hostname, ALPNProtocols: ['http/1.1'] }, () => {
        secure.write(
          [
            `GET ${target.pathname}${target.search} HTTP/1.1`,
            `Host: ${target.host}`,
            'User-Agent: naxlo/1.0',
            'Accept: application/json',
            'Connection: close',
            '',
            ''
          ].join('\r\n')
        )
      })
      const chunks: Buffer[] = []
      secure.on('data', (c) => chunks.push(Buffer.from(c)))
      secure.on('error', () => {
        secure.destroy()
        clearTimeout(timer)
        resolve(null)
      })
      secure.on('close', () => {
        clearTimeout(timer)
        const body = Buffer.concat(chunks).toString('utf8')
        const split = body.indexOf('\r\n\r\n')
        const payload = split >= 0 ? body.slice(split + 4) : body
        try {
          resolve(JSON.parse(payload))
        } catch {
          resolve(null)
        }
      })
    })
    connectReq.end()
  })
}
