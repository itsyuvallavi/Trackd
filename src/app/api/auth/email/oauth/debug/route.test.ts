import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

function request() {
  return new NextRequest('https://trackd.test/api/auth/email/oauth/debug')
}

describe('/api/auth/email/oauth/debug', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    mocks.getCurrentUser.mockReset()
  })

  it('is available in non-production without exposing secret presence', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'configured-secret')

    const { GET } = await import('./route')
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.callbackUrl).toBe('https://trackd.test/api/auth/email/oauth/callback')
    expect(body.environmentVariables).not.toHaveProperty('GOOGLE_CLIENT_SECRET')
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
  })

  it('hides production debug details from non-admin users', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_EMAIL', 'admin@trackd.test')
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1', email: 'visitor@trackd.test' })

    const { GET } = await import('./route')
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Not found' })
  })

  it('allows production debug details for the configured admin only', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_EMAIL', 'admin@trackd.test')
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin_1', email: 'admin@trackd.test' })

    const { GET } = await import('./route')
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.environmentVariables).not.toHaveProperty('GOOGLE_CLIENT_SECRET')
    expect(body.instructions.google).toContain('/api/auth/email/oauth/callback')
  })
})
