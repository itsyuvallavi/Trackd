import { describe, expect, it } from 'vitest'
import { isCronRequestAuthorized } from './cron-auth'

describe('cron auth', () => {
  it('rejects spoofed Vercel cron headers in production', () => {
    const headers = new Headers({
      'x-vercel-cron': '1',
      'x-vercel-signature': 'spoofed',
    })

    expect(isCronRequestAuthorized(headers, { NODE_ENV: 'production', CRON_SECRET: 'secret' })).toBe(false)
  })

  it('rejects production cron requests when no shared secret is configured', () => {
    const headers = new Headers({
      authorization: 'Bearer secret',
    })

    expect(isCronRequestAuthorized(headers, { NODE_ENV: 'production' })).toBe(false)
  })

  it('accepts production cron requests with the exact bearer secret', () => {
    const headers = new Headers({
      authorization: 'Bearer secret',
      'x-vercel-cron': '1',
    })

    expect(isCronRequestAuthorized(headers, { NODE_ENV: 'production', CRON_SECRET: 'secret' })).toBe(true)
  })

  it('keeps development open unless a shared secret is configured', () => {
    expect(isCronRequestAuthorized(new Headers(), { NODE_ENV: 'development' })).toBe(true)
    expect(isCronRequestAuthorized(new Headers(), { NODE_ENV: 'development', CRON_SECRET: 'secret' })).toBe(false)
    expect(
      isCronRequestAuthorized(
        new Headers({ authorization: 'Bearer secret' }),
        { NODE_ENV: 'development', CRON_SECRET: 'secret' },
      ),
    ).toBe(true)
  })
})
