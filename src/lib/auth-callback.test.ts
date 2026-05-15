import { describe, expect, it } from 'vitest'
import {
  authErrorMessage,
  postAuthRedirectPath,
  profileFieldsFromAuthUser,
  safeAuthRedirectPath,
} from './auth-callback'

describe('auth callback helpers', () => {
  it('allows only local post-auth redirect paths', () => {
    expect(safeAuthRedirectPath('/jobs?view=board')).toBe('/jobs?view=board')
    expect(safeAuthRedirectPath('https://evil.example/jobs')).toBe('/jobs')
    expect(safeAuthRedirectPath('//evil.example/jobs')).toBe('/jobs')
    expect(safeAuthRedirectPath('jobs')).toBe('/jobs')
  })

  it('sends users without onboarding to onboarding regardless of next', () => {
    expect(
      postAuthRedirectPath({
        next: '/jobs',
        hasCompletedOnboarding: false,
      }),
    ).toBe('/onboarding')
  })

  it('sends onboarded users to a sanitized next path', () => {
    expect(
      postAuthRedirectPath({
        next: '/today',
        hasCompletedOnboarding: true,
      }),
    ).toBe('/today')
    expect(
      postAuthRedirectPath({
        next: 'https://evil.example',
        hasCompletedOnboarding: true,
      }),
    ).toBe('/jobs')
  })

  it('builds profile fields from Google metadata', () => {
    expect(
      profileFieldsFromAuthUser({
        id: 'user_123',
        email: 'person@example.com',
        metadata: {
          full_name: 'Person Example',
          avatar_url: 'https://example.com/avatar.png',
        },
      }),
    ).toEqual({
      id: 'user_123',
      email: 'person@example.com',
      name: 'Person Example',
      avatarUrl: 'https://example.com/avatar.png',
    })
  })

  it('requires an email before profile upsert', () => {
    expect(() =>
      profileFieldsFromAuthUser({
        id: 'user_123',
        email: null,
        metadata: {},
      }),
    ).toThrow('Auth user is missing an email address')
  })

  it('maps stable callback errors to user-facing messages', () => {
    expect(authErrorMessage('auth_failed')).toBe('Google sign-in failed. Please try again.')
    expect(authErrorMessage('unknown')).toBeNull()
  })
})
