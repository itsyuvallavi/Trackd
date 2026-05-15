import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  profileUpsert: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      upsert: mocks.profileUpsert,
    },
  },
}))

import { GET } from './route'

function locationOf(response: Response): string {
  const location = response.headers.get('location')
  if (!location) {
    throw new Error('Expected redirect location header')
  }
  return location
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user_123',
          email: 'person@example.com',
          user_metadata: {
            full_name: 'Person Example',
            avatar_url: 'https://example.com/avatar.png',
          },
        },
      },
      error: null,
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
        signOut: mocks.signOut,
      },
    })
    mocks.profileUpsert.mockResolvedValue({})
  })

  it('redirects provider callback errors to login without touching Supabase', async () => {
    const response = await GET(
      new Request(
        'https://trackd.test/auth/callback?error=access_denied&error_description=denied&next=%2Ftoday',
      ),
    )

    expect(response.status).toBe(307)
    expect(locationOf(response)).toBe('https://trackd.test/login?next=%2Ftoday&error=auth_failed')
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.profileUpsert).not.toHaveBeenCalled()
  })

  it('sanitizes provider error next URLs before sending users back to login', async () => {
    const response = await GET(
      new Request(
        'https://trackd.test/auth/callback?error=access_denied&next=https%3A%2F%2Fevil.example%2Fjobs',
      ),
    )

    expect(response.status).toBe(307)
    expect(locationOf(response)).toBe('https://trackd.test/login?next=%2Fjobs&error=auth_failed')
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('redirects missing auth codes to login with a stable error code', async () => {
    const response = await GET(new Request('https://trackd.test/auth/callback'))

    expect(response.status).toBe(307)
    expect(locationOf(response)).toBe('https://trackd.test/login?error=missing_code')
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('returns a deterministic configuration error when the server Supabase client cannot be built', async () => {
    mocks.createClient.mockRejectedValueOnce(new Error('missing env'))

    const response = await GET(
      new Request('https://trackd.test/auth/callback?code=google-code&next=%2Fboard'),
    )

    expect(response.status).toBe(307)
    expect(locationOf(response)).toBe(
      'https://trackd.test/login?next=%2Fboard&error=auth_not_configured',
    )
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(mocks.profileUpsert).not.toHaveBeenCalled()
  })

  it('redirects failed code exchanges without creating a profile', async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid grant' },
    })

    const response = await GET(
      new Request('https://trackd.test/auth/callback?code=bad-code&next=%2Fjobs'),
    )

    expect(locationOf(response)).toBe('https://trackd.test/login?next=%2Fjobs&error=auth_failed')
    expect(mocks.profileUpsert).not.toHaveBeenCalled()
  })

  it('signs out and redirects when profile setup fails after Google auth succeeds', async () => {
    mocks.profileUpsert.mockRejectedValueOnce(new Error('db unavailable'))

    const response = await GET(new Request('https://trackd.test/auth/callback?code=google-code'))

    expect(mocks.profileUpsert).toHaveBeenCalledWith({
      where: { id: 'user_123' },
      create: {
        id: 'user_123',
        email: 'person@example.com',
        name: 'Person Example',
        avatarUrl: 'https://example.com/avatar.png',
      },
      update: {
        email: 'person@example.com',
        name: 'Person Example',
        avatarUrl: 'https://example.com/avatar.png',
      },
    })
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(locationOf(response)).toBe('https://trackd.test/login?error=profile_setup_failed')
  })

  it('sends new users to onboarding after profile setup', async () => {
    const response = await GET(
      new Request('https://trackd.test/auth/callback?code=google-code&next=%2Fjobs'),
    )

    expect(mocks.profileUpsert).toHaveBeenCalledTimes(1)
    expect(locationOf(response)).toBe('https://trackd.test/onboarding')
  })

  it('sanitizes external next URLs for onboarded users', async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user_123',
          email: 'person@example.com',
          user_metadata: {
            onboarding_completed: true,
          },
        },
      },
      error: null,
    })

    const response = await GET(
      new Request(
        'https://trackd.test/auth/callback?code=google-code&next=https%3A%2F%2Fevil.example%2Fjobs',
      ),
    )

    expect(locationOf(response)).toBe('https://trackd.test/jobs')
  })

  it('allows local next URLs for onboarded users', async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user_123',
          email: 'person@example.com',
          user_metadata: {
            onboarding_completed: true,
          },
        },
      },
      error: null,
    })

    const response = await GET(
      new Request('https://trackd.test/auth/callback?code=google-code&next=%2Ftoday%3Fview%3Dweek'),
    )

    expect(locationOf(response)).toBe('https://trackd.test/today?view=week')
  })
})
