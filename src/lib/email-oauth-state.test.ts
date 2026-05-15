import { describe, expect, it } from 'vitest'
import {
  createEmailOAuthState,
  safeEmailOAuthRedirectPath,
  verifyEmailOAuthState,
} from './email-oauth-state'

describe('email OAuth state', () => {
  const secret = 'test-state-secret'
  const nowMs = Date.parse('2026-05-15T08:00:00.000Z')

  it('keeps only local redirect paths', () => {
    expect(safeEmailOAuthRedirectPath('/settings/integrations?tab=email')).toBe(
      '/settings/integrations?tab=email',
    )
    expect(safeEmailOAuthRedirectPath('https://evil.example/callback')).toBe('/settings/integrations')
    expect(safeEmailOAuthRedirectPath('//evil.example/callback')).toBe('/settings/integrations')
    expect(safeEmailOAuthRedirectPath('settings/integrations')).toBe('/settings/integrations')
  })

  it('creates and verifies signed state', () => {
    const state = createEmailOAuthState(
      {
        provider: 'google',
        redirectTo: '/onboarding?step=email',
        userId: 'user_123',
      },
      { secret, nowMs, nonce: 'nonce' },
    )

    const verified = verifyEmailOAuthState(state, { secret, nowMs: nowMs + 1000 })

    expect(verified.ok).toBe(true)
    if (verified.ok) {
      expect(verified.payload).toMatchObject({
        provider: 'google',
        redirectTo: '/onboarding?step=email',
        userId: 'user_123',
        nonce: 'nonce',
      })
    }
  })

  it('rejects unsigned JSON state', () => {
    const state = JSON.stringify({
      provider: 'google',
      redirectTo: '/settings/integrations',
      userId: 'user_123',
    })

    expect(verifyEmailOAuthState(state, { secret, nowMs })).toEqual({
      ok: false,
      error: 'invalid_state',
    })
  })

  it('rejects tampered state', () => {
    const state = createEmailOAuthState(
      {
        provider: 'google',
        redirectTo: '/settings/integrations',
        userId: 'user_123',
      },
      { secret, nowMs, nonce: 'nonce' },
    )
    const [encodedPayload, signature] = state.split('.')
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, redirectTo: '/admin' }),
      'utf8',
    ).toString('base64url')

    expect(verifyEmailOAuthState(`${tamperedPayload}.${signature}`, { secret, nowMs })).toEqual({
      ok: false,
      error: 'invalid_state',
    })
  })

  it('rejects expired state', () => {
    const state = createEmailOAuthState(
      {
        provider: 'microsoft',
        redirectTo: '/settings/integrations',
        userId: 'user_123',
      },
      { secret, nowMs, ttlMs: 1000, nonce: 'nonce' },
    )

    expect(verifyEmailOAuthState(state, { secret, nowMs: nowMs + 1001 })).toEqual({
      ok: false,
      error: 'expired_state',
    })
  })
})
