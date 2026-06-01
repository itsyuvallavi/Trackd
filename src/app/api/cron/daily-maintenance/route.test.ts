import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  archiveInactiveJobsForAllUsers: vi.fn(),
  runScheduledBotSearch: vi.fn(),
}))

vi.mock('@/lib/auto-archive', () => ({
  archiveInactiveJobsForAllUsers: mocks.archiveInactiveJobsForAllUsers,
}))

vi.mock('@/lib/bot/scheduled-bot-search', () => ({
  runScheduledBotSearch: mocks.runScheduledBotSearch,
}))

function request(headers: HeadersInit = {}) {
  return new Request('https://trackd.test/api/cron/daily-maintenance', { headers })
}

describe('/api/cron/daily-maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('AUTO_ARCHIVE_DAYS', '30')
    mocks.archiveInactiveJobsForAllUsers.mockResolvedValue({
      totalUsersProcessed: 2,
      totalJobsArchived: 3,
      resultsByUser: {
        user_1: { jobsArchived: 3, jobIds: ['job_1'], errors: [] },
        user_2: { jobsArchived: 0, jobIds: [], errors: ['failed'] },
      },
    })
    mocks.runScheduledBotSearch.mockResolvedValue({
      status: 200,
      body: {
        usersProcessed: 1,
        results: { user_1: { jobsNew: 2, jobsApproved: 1 } },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('runs auto-archive and due bot searches from one scheduled slot', async () => {
    const { GET } = await import('./route')

    const response = await GET(request({ authorization: 'Bearer cron-secret' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.archiveInactiveJobsForAllUsers).toHaveBeenCalledWith(30)
    expect(mocks.runScheduledBotSearch).toHaveBeenCalledTimes(1)
    expect(body).toEqual({
      success: true,
      archive: {
        enabled: true,
        daysSinceUpdate: 30,
        totalUsersProcessed: 2,
        totalJobsArchived: 3,
        totalErrors: 1,
      },
      botSearch: {
        usersProcessed: 1,
        results: { user_1: { jobsNew: 2, jobsApproved: 1 } },
      },
    })
  })

  it('rejects unauthorized requests before running maintenance work', async () => {
    const { GET } = await import('./route')

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.archiveInactiveJobsForAllUsers).not.toHaveBeenCalled()
    expect(mocks.runScheduledBotSearch).not.toHaveBeenCalled()
  })

  it('still runs bot search when auto-archive is disabled', async () => {
    vi.stubEnv('AUTO_ARCHIVE_ENABLED', 'false')
    const { GET } = await import('./route')

    const response = await GET(request({ authorization: 'Bearer cron-secret' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.archiveInactiveJobsForAllUsers).not.toHaveBeenCalled()
    expect(mocks.runScheduledBotSearch).toHaveBeenCalledTimes(1)
    expect(body.archive).toEqual({
      enabled: false,
      message: 'Auto-archive is disabled',
    })
  })
})
