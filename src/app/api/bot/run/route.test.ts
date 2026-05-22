import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  botConfigFindUnique: vi.fn(),
  botSearchHasQueryableBackend: vi.fn(),
  startBotRunForConfig: vi.fn(),
  markStartedBotRunFailed: vi.fn(),
  enqueueManualBotRun: vi.fn(),
  revalidateBotRunViews: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botConfig: {
      findUnique: mocks.botConfigFindUnique,
    },
  },
}))

vi.mock('@/lib/bot/bot-search-sources', () => ({
  botSearchHasQueryableBackend: mocks.botSearchHasQueryableBackend,
}))

vi.mock('@/lib/bot/execute-bot-run', () => ({
  startBotRunForConfig: mocks.startBotRunForConfig,
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
    mocks.enqueueManualBotRun.mockResolvedValue({ messageId: 'msg_1' })
  })

  it('reserves a run, enqueues durable manual work, and returns immediately', async () => {
    const { POST } = await import('./route')
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(mocks.startBotRunForConfig).toHaveBeenCalledWith(config, 'manual')
    expect(mocks.enqueueManualBotRun).toHaveBeenCalledWith({
      runId: 'run_1',
      configId: 'cfg_1',
      userId: 'user_1',
    })
    expect(body).toMatchObject({
      success: true,
      status: 'queued',
      runId: 'run_1',
      messageId: 'msg_1',
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

  it('marks the reserved run failed if queue publishing fails', async () => {
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
