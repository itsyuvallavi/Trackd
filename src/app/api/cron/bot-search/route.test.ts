import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  executeBotRunForConfig: vi.fn(),
  botSearchHasQueryableBackend: vi.fn(),
  isBotConfigDueForSearch: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botConfig: {
      findMany: mocks.findMany,
    },
  },
}))

vi.mock('@/lib/bot/execute-bot-run', () => ({
  executeBotRunForConfig: mocks.executeBotRunForConfig,
}))

vi.mock('@/lib/bot/bot-search-sources', () => ({
  botSearchHasQueryableBackend: mocks.botSearchHasQueryableBackend,
}))

vi.mock('@/lib/bot/search-schedule', () => ({
  isBotConfigDueForSearch: mocks.isBotConfigDueForSearch,
}))

function request(headers: HeadersInit = {}) {
  return new Request('https://trackd.test/api/cron/bot-search', { headers })
}

function botConfig(id: string) {
  return {
    id,
    userId: `user_${id}`,
    keywords: ['Engineer'],
  }
}

describe('/api/cron/bot-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    mocks.botSearchHasQueryableBackend.mockReturnValue(true)
    mocks.executeBotRunForConfig.mockResolvedValue({ jobsNew: 2, jobsApproved: 1 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects spoofed Vercel cron headers in production', async () => {
    const { GET } = await import('./route')

    const response = await GET(request({ 'x-vercel-cron': '1' }))

    expect(response.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(mocks.executeBotRunForConfig).not.toHaveBeenCalled()
  })

  it('runs only configs that are due for search', async () => {
    const dueConfig = botConfig('due')
    const notDueConfig = botConfig('not_due')
    mocks.findMany.mockResolvedValue([dueConfig, notDueConfig])
    mocks.isBotConfigDueForSearch.mockImplementation((config: { id: string }) => config.id === 'due')

    const { GET } = await import('./route')
    const response = await GET(
      request({ authorization: 'Bearer cron-secret', 'x-vercel-cron': '1' }),
    )

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { isActive: true, keywords: { isEmpty: false } },
    })
    expect(mocks.executeBotRunForConfig).toHaveBeenCalledTimes(1)
    expect(mocks.executeBotRunForConfig).toHaveBeenCalledWith(dueConfig, 'cron')
    await expect(response.json()).resolves.toEqual({
      usersProcessed: 1,
      results: {
        user_due: { jobsNew: 2, jobsApproved: 1 },
      },
    })
  })

  it('reports when active configs exist but none are due', async () => {
    mocks.findMany.mockResolvedValue([botConfig('a'), botConfig('b')])
    mocks.isBotConfigDueForSearch.mockReturnValue(false)

    const { GET } = await import('./route')
    const response = await GET(request({ authorization: 'Bearer cron-secret' }))

    expect(response.status).toBe(200)
    expect(mocks.executeBotRunForConfig).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      message: 'No bot configs due for search',
      usersProcessed: 0,
      activeConfigs: 2,
    })
  })

  it('returns 503 before querying users when no search backend is configured', async () => {
    mocks.botSearchHasQueryableBackend.mockReturnValue(false)

    const { GET } = await import('./route')
    const response = await GET(request({ authorization: 'Bearer cron-secret' }))

    expect(response.status).toBe(503)
    expect(mocks.findMany).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: 'No search backends configured (keys and/or BOT_SEARCH_SOURCES allowlist)',
    })
  })
})
