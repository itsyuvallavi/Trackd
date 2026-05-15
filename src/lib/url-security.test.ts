import { describe, expect, it } from 'vitest'
import {
  isBlockedInternalHostname,
  validatePublicHttpRedirect,
  validatePublicHttpUrl,
} from './url-security'

describe('url security helpers', () => {
  it('allows public HTTP and HTTPS URLs', () => {
    expect(validatePublicHttpUrl('https://example.com/jobs/1').ok).toBe(true)
    expect(validatePublicHttpUrl('http://careers.example.com/jobs/1').ok).toBe(true)
  })

  it('rejects non-http protocols', () => {
    expect(validatePublicHttpUrl('file:///etc/passwd')).toEqual({
      ok: false,
      error: 'Only HTTP and HTTPS URLs are allowed',
    })
  })

  it('blocks localhost, private IPv4, and metadata IP ranges', () => {
    expect(isBlockedInternalHostname('localhost')).toBe(true)
    expect(isBlockedInternalHostname('127.0.0.1')).toBe(true)
    expect(isBlockedInternalHostname('10.1.2.3')).toBe(true)
    expect(isBlockedInternalHostname('172.16.0.1')).toBe(true)
    expect(isBlockedInternalHostname('192.168.1.10')).toBe(true)
    expect(isBlockedInternalHostname('169.254.169.254')).toBe(true)
    expect(isBlockedInternalHostname('100.64.0.1')).toBe(true)
  })

  it('blocks local/internal hostnames and common IPv6 local forms', () => {
    expect(isBlockedInternalHostname('printer.local')).toBe(true)
    expect(isBlockedInternalHostname('service.internal')).toBe(true)
    expect(isBlockedInternalHostname('[::1]')).toBe(true)
    expect(isBlockedInternalHostname('fe80::1')).toBe(true)
    expect(isBlockedInternalHostname('fd00::1')).toBe(true)
    expect(isBlockedInternalHostname('::ffff:169.254.169.254')).toBe(true)
    expect(isBlockedInternalHostname('::ffff:172.16.0.1')).toBe(true)
  })

  it('does not block ordinary public hosts', () => {
    expect(isBlockedInternalHostname('example.com')).toBe(false)
    expect(isBlockedInternalHostname('8.8.8.8')).toBe(false)
  })

  it('validates redirects before following them', () => {
    const currentUrl = new URL('https://jobs.example.com/posting')

    expect(validatePublicHttpRedirect(currentUrl, '/next')).toMatchObject({
      ok: true,
      url: new URL('https://jobs.example.com/next'),
    })
    expect(validatePublicHttpRedirect(currentUrl, 'http://169.254.169.254/latest')).toEqual({
      ok: false,
      error: 'Internal URLs are not allowed',
    })
    expect(validatePublicHttpRedirect(currentUrl, 'file:///etc/passwd')).toEqual({
      ok: false,
      error: 'Only HTTP and HTTPS URLs are allowed',
    })
  })
})
