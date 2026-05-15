import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { sessionRateLimitIdentifier, shouldAuthenticateInProxy } from './proxy'

describe('proxy auth gating', () => {
  it('does not verify auth for public pages', () => {
    expect(shouldAuthenticateInProxy('/')).toBe(false)
    expect(shouldAuthenticateInProxy('/pricing')).toBe(false)
  })

  it('does not verify auth for general API routes in proxy', () => {
    expect(shouldAuthenticateInProxy('/api/bot/queue/count')).toBe(false)
    expect(shouldAuthenticateInProxy('/api/auth/email/oauth')).toBe(false)
  })

  it('verifies auth for protected and auth redirect routes', () => {
    expect(shouldAuthenticateInProxy('/jobs')).toBe(true)
    expect(shouldAuthenticateInProxy('/settings/integrations')).toBe(true)
    expect(shouldAuthenticateInProxy('/login')).toBe(true)
    expect(shouldAuthenticateInProxy('/signup')).toBe(true)
  })

  it('keeps upload rate limiting user-scoped', () => {
    expect(shouldAuthenticateInProxy('/api/resume/upload')).toBe(true)
  })

  it('can rate-limit API requests by session cookie without verified auth', () => {
    const request = new NextRequest('https://trackd.test/api/bot/queue/count', {
      headers: {
        cookie: 'sb-project-auth-token=secret-session-token',
      },
    })

    const identifier = sessionRateLimitIdentifier(request)

    expect(identifier).toMatch(/^[a-z0-9]+$/)
    expect(identifier).not.toContain('secret-session-token')
  })
})
