/**
 * Masking helpers shared by the main process and the renderer.
 *
 * These functions define exactly how much of a sensitive value Naxlo is
 * willing to show on screen. Raw secrets never leave the main process unless
 * the user explicitly asks for them.
 */

export function maskMiddle(value: string | null | undefined, head = 4, tail = 4): string {
  if (!value) return ''
  const v = String(value)
  if (v.length <= head + tail) return '•'.repeat(v.length)
  return `${v.slice(0, head)}${'•'.repeat(Math.min(12, v.length - head - tail))}${v.slice(-tail)}`
}

export function maskUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return ''
  try {
    const u = new URL(rawUrl)
    const host = u.hostname
    const maskedHost =
      host.length > 8 ? `${host.slice(0, 4)}${'•'.repeat(6)}${host.slice(-4)}` : '•'.repeat(host.length)
    const path = u.pathname
    const maskedPath = path.length > 2 ? `/${path.slice(1, 4)}${'•'.repeat(Math.min(10, path.length - 2))}` : path
    return `${u.protocol}//${maskedHost}${maskedPath}${u.search ? '?•••' : ''}`
  } catch {
    return maskMiddle(rawUrl, 6, 3)
  }
}

export function maskAddress(address: string | null | undefined): string {
  if (!address) return ''
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(address)
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.••.••`
  if (address.includes(':')) {
    const parts = address.split(':')
    return parts.length > 2 ? `${parts[0]}:${parts[1]}:••••` : `${parts[0]}:••••`
  }
  return maskMiddle(address, 3, 3)
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return ''
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return `${parts[0]}:${parts[1] || ''}:••••`
  }
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.••.••`
  return maskMiddle(ip, 3, 2)
}
