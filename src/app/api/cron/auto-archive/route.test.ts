import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  archiveInactiveJobsForAllUsers: vi.fn(),
}))

vi.mock('@/lib/auto-archive', () => ({
  archiveInactiveJobsForAllUsers: mocks.archiveInactiveJobsForAllUsers,
}))

function request(headers: HeadersInit = {}) {
  return new Request('https://trackd.test/api/cron/auto-archive', { headers })
}

describe('/api/cron/auto-archive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('AUTO_ARCHIVE_ENABLED', 'true')
    vi.stubEnv('AUTO_ARCHIVE_DAYS', '30')
    mocks.archiveInactiveJobsForAllUsers.mockResolvedValue({
      totalUsersProcessed: 2,
      totalJobsArchived: 3,
      resultsByUser: {
        user_1: { jobsArchived: 3, errors: [] },
        user_2: { jobsArchived: 0, errors: ['one failure'] },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects spoofed Vercel cron headers in production', async () => {
    const { GET } = await import('./route')

    const response = await GET(request({ 'x-vercel-cron': '1' }))

    expect(response.status).toBe(401)
    expect(mocks.archiveInactiveJobsForAllUsers).not.toHaveBeenCalled()
  })

  it('archives inactive jobs when authorized', async () => {
    const { GET } = await import('./route')

    const response = await GET(request({ authorization: 'Bearer cron-secret' }))

    expect(response.status).toBe(200)
    expect(mocks.archiveInactiveJobsForAllUsers).toHaveBeenCalledWith(30)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      enabled: true,
      config: { daysSinceUpdate: 30 },
      results: {
        totalUsersProcessed: 2,
        totalJobsArchived: 3,
        totalErrors: 1,
      },
    })
  })

  it('does not archive when the feature flag is disabled', async () => {
    vi.stubEnv('AUTO_ARCHIVE_ENABLED', 'false')
    const { GET } = await import('./route')

    const response = await GET(request({ authorization: 'Bearer cron-secret' }))

    expect(response.status).toBe(200)
    expect(mocks.archiveInactiveJobsForAllUsers).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      message: 'Auto-archive is disabled',
      enabled: false,
    })
  })
})
