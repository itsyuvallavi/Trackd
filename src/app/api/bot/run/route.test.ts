import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  botConfigFindUnique: vi.fn(),
  botRunUpdate: vi.fn(),
  botSearchHasQueryableBackend: vi.fn(),
  startBotRunForConfig: vi.fn(),
  executeStartedBotRunForConfig: vi.fn(),
  markStartedBotRunFailed: vi.fn(),
  enqueueManualBotRun: vi.fn(),
  revalidateBotRunViews: vi.fn(),
  after: vi.fn((task: () => void | Promise<void>) => {
    void task()
  }),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: mocks.after,
  }
})

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botConfig: {
      findUnique: mocks.botConfigFindUnique,
    },
    botRun: {
      update: mocks.botRunUpdate,
    },
  },
}))

vi.mock('@/lib/bot/bot-search-sources', () => ({
  botSearchHasQueryableBackend: mocks.botSearchHasQueryableBackend,
}))

vi.mock('@/lib/bot/execute-bot-run', () => ({
  startBotRunForConfig: mocks.startBotRunForConfig,
  executeStartedBotRunForConfig: mocks.executeStartedBotRunForConfig,
  markStartedBotRunFailed: mocks.markStartedBotRunFailed,
}))

vi.mock('@/lib/bot/manual-run-queue', () => ({
  enqueueManualBotRun: mocks.enqueueManualBotRun,
}))

vi.mock('@/lib/bot/revalidate-bot-run-views', () => ({
  revalidateBotRunViews: mocks.revalidateBotRunViews,
}))

const config = {
  id: 'cfg_1',
  userId: 'user_1',
  keywords: ['Frontend Engineer'],
}

describe('/api/bot/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1' })
    mocks.botConfigFindUnique.mockResolvedValue(config)
    mocks.botSearchHasQueryableBackend.mockReturnValue(true)
    mocks.startBotRunForConfig.mockResolvedValue({
      started: true,
      runId: 'run_1',
      startedAt: new Date('2026-05-22T10:00:00.000Z'),
    })
    mocks.botRunUpdate.mockResolvedValue({})
    mocks.executeStartedBotRunForConfig.mockResolvedValue({
      runId: 'run_1',
      jobsFound: 1,
      jobsNew: 1,
      jobsApproved: 1,
      jobsHardFiltered: 0,
      jobsSkippedLowScore: 0,
      jobsEvaluationFailed: 0,
    })
    mocks.enqueueManualBotRun.mockResolvedValue({ messageId: 'msg_1' })
    delete process.env.BOT_MANUAL_RUN_USE_QUEUE
  })

  it('reserves a run, starts post-response manual work, and returns immediately', async () => {
    const { POST } = await import('./route')
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(mocks.startBotRunForConfig).toHaveBeenCalledWith(config, 'manual')
    expect(mocks.botRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run_1' },
      data: {
        startedAt: expect.any(Date),
        duration: null,
      },
    })
    expect(mocks.after).toHaveBeenCalledTimes(1)
    expect(mocks.executeStartedBotRunForConfig).toHaveBeenCalledWith(config, 'manual', {
      id: 'run_1',
      startedAt: expect.any(Date),
    })
    expect(mocks.enqueueManualBotRun).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      success: true,
      status: 'started',
      runId: 'run_1',
      messageId: null,
    })
  })

  it('returns the active run when a manual search is already running', async () => {
    mocks.startBotRunForConfig.mockResolvedValue({
      started: false,
      runId: 'run_active',
      jobsFound: 0,
      jobsNew: 0,
      jobsApproved: 0,
      jobsHardFiltered: 0,
      jobsSkippedLowScore: 0,
      jobsEvaluationFailed: 0,
      error: 'A job search is already running. Wait for it to finish before starting another run.',
    })

    const { POST } = await import('./route')
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(mocks.enqueueManualBotRun).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      success: false,
      runId: 'run_active',
    })
  })

  it('can still use the durable queue path when explicitly enabled', async () => {
    process.env.BOT_MANUAL_RUN_USE_QUEUE = '1'
    const { POST } = await import('./route')
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(mocks.enqueueManualBotRun).toHaveBeenCalledWith({
      runId: 'run_1',
      configId: 'cfg_1',
      userId: 'user_1',
    })
    expect(mocks.executeStartedBotRunForConfig).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      success: true,
      status: 'queued',
      runId: 'run_1',
      messageId: 'msg_1',
    })
  })

  it('marks the reserved run failed if queue publishing fails', async () => {
    process.env.BOT_MANUAL_RUN_USE_QUEUE = '1'
    mocks.enqueueManualBotRun.mockRejectedValue(new Error('queue unavailable'))

    const { POST } = await import('./route')
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(mocks.markStartedBotRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        botRunId: 'run_1',
        error: 'Could not queue manual job search: queue unavailable',
      })
    )
    expect(body).toMatchObject({
      success: false,
      runId: 'run_1',
    })
  })
})
