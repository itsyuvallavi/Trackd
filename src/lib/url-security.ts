import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'

type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: string }

type PublicHttpTextResult =
  | {
      ok: true
      url: URL
      status: number
      statusText: string
      headers: Headers
      text: string
    }
  | { ok: false; error: string; status: number }

type PublicHttpTextOptions = {
  headers?: Record<string, string>
  maxBytes?: number
  maxRedirects?: number
  timeoutMs?: number
}

class PublicHttpFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '')
}

function ipv4Parts(hostname: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null
  return parts
}

function isPrivateIpv4Mapped(host: string, prefix: string): boolean {
  return host.startsWith(`::ffff:${prefix}`)
}

export function isBlockedInternalHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname)

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }

  const v4 = ipv4Parts(host)
  if (v4) {
    const [a, b] = v4
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }

  if (
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:') ||
    host.startsWith('::ffff:127.') ||
    host.startsWith('::ffff:10.') ||
    host.startsWith('::ffff:192.168.') ||
    isPrivateIpv4Mapped(host, '169.254.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return true
  }

  return false
}

export function validatePublicHttpUrl(rawUrl: string): UrlValidationResult {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: 'Invalid URL format' }
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Only HTTP and HTTPS URLs are allowed' }
  }

  if (isBlockedInternalHostname(url.hostname)) {
    return { ok: false, error: 'Internal URLs are not allowed' }
  }

  return { ok: true, url }
}

export function validatePublicHttpRedirect(currentUrl: URL, location: string | null): UrlValidationResult {
  if (!location) {
    return { ok: false, error: 'Redirect location is missing' }
  }

  try {
    return validatePublicHttpUrl(new URL(location, currentUrl).toString())
  } catch {
    return { ok: false, error: 'Invalid redirect URL' }
  }
}

export async function fetchPublicHttpText(
  rawUrl: string,
  options: PublicHttpTextOptions = {},
): Promise<PublicHttpTextResult> {
  const maxRedirects = options.maxRedirects ?? 5
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024
  const timeoutMs = options.timeoutMs ?? 10_000
  let current = validatePublicHttpUrl(rawUrl)

  if (!current.ok) {
    return { ok: false, error: current.error, status: 400 }
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const resolution = await resolvePublicAddress(current.url.hostname)
    if (!resolution.ok) {
      return { ok: false, error: resolution.error, status: 400 }
    }

    try {
      const response = await requestPublicHttpText(current.url, resolution.address, {
        headers: options.headers,
        maxBytes,
        timeoutMs,
      })

      if (isRedirectStatus(response.status)) {
        if (redirectCount === maxRedirects) {
          return { ok: false, error: 'Too many redirects', status: 400 }
        }

        const redirect = validatePublicHttpRedirect(current.url, response.headers.get('location'))
        if (!redirect.ok) {
          return { ok: false, error: 'Redirected URL is not allowed', status: 400 }
        }

        current = redirect
        continue
      }

      return response
    } catch (error) {
      if (error instanceof PublicHttpFetchError) {
        return { ok: false, error: error.message, status: error.status }
      }

      return { ok: false, error: 'Failed to fetch URL', status: 400 }
    }
  }

  return { ok: false, error: 'Too many redirects', status: 400 }
}

async function resolvePublicAddress(hostname: string): Promise<
  | { ok: true; address: string }
  | { ok: false; error: string }
> {
  if (isBlockedInternalHostname(hostname)) {
    return { ok: false, error: 'Internal URLs are not allowed' }
  }

  let records: Array<{ address: string; family: number }>
  try {
    records = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    return { ok: false, error: 'Failed to resolve URL host' }
  }

  if (records.length === 0) {
    return { ok: false, error: 'Failed to resolve URL host' }
  }

  if (records.some((record) => isBlockedInternalHostname(record.address))) {
    return { ok: false, error: 'Internal URLs are not allowed' }
  }

  return { ok: true, address: records[0].address }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400
}

function requestPublicHttpText(
  url: URL,
  resolvedAddress: string,
  options: Required<Pick<PublicHttpTextOptions, 'maxBytes' | 'timeoutMs'>> & {
    headers?: Record<string, string>
  },
): Promise<Extract<PublicHttpTextResult, { ok: true }>> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:'
    const transport = isHttps ? https : http
    const request = transport.request(
      {
        hostname: resolvedAddress,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          ...(options.headers ?? {}),
          Host: url.host,
        },
        servername: isHttps ? url.hostname : undefined,
      },
      (response) => {
        const headers = new Headers()
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(key, item)
          } else if (value !== undefined) {
            headers.set(key, value)
          }
        }

        const contentLength = headers.get('content-length')
        if (contentLength && Number.parseInt(contentLength, 10) > options.maxBytes) {
          response.resume()
          reject(new PublicHttpFetchError('Response too large', 400))
          return
        }

        const chunks: Buffer[] = []
        let totalSize = 0

        response.on('data', (chunk: Buffer) => {
          totalSize += chunk.length
          if (totalSize > options.maxBytes) {
            request.destroy(new PublicHttpFetchError('Response too large', 400))
            return
          }
          chunks.push(Buffer.from(chunk))
        })

        response.on('end', () => {
          resolve({
            ok: true,
            url,
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? '',
            headers,
            text: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )

    request.setTimeout(options.timeoutMs, () => {
      request.destroy(new PublicHttpFetchError('Request timeout', 408))
    })
    request.on('error', reject)
    request.end()
  })
}
