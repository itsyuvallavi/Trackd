import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  botRunFindFirst: vi.fn(),
  botConfigFindFirst: vi.fn(),
  executeStartedBotRunForConfig: vi.fn(),
  markStartedBotRunFailed: vi.fn(),
  revalidateBotRunViews: vi.fn(),
}))

vi.mock('@/lib/bot/manual-run-queue', () => ({
  handleManualBotRunCallback:
    (handler: (message: unknown, metadata: { deliveryCount: number }) => Promise<void>) =>
    async (request: Request) => {
      const body = await request.json()
      await handler(body, { deliveryCount: 1 })
      return Response.json({ ok: true })
    },
  isBotManualRunMessage: (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const msg = value as Record<string, unknown>
    return (
      typeof msg.runId === 'string' &&
      typeof msg.configId === 'string' &&
      typeof msg.userId === 'string'
    )
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botRun: {
      findFirst: mocks.botRunFindFirst,
    },
    botConfig: {
      findFirst: mocks.botConfigFindFirst,
    },
  },
}))

vi.mock('@/lib/bot/execute-bot-run', () => ({
  executeStartedBotRunForConfig: mocks.executeStartedBotRunForConfig,
  markStartedBotRunFailed: mocks.markStartedBotRunFailed,
}))

vi.mock('@/lib/bot/revalidate-bot-run-views', () => ({
  revalidateBotRunViews: mocks.revalidateBotRunViews,
}))

const message = {
  runId: 'run_1',
  configId: 'cfg_1',
  userId: 'user_1',
}

const run = {
  id: 'run_1',
  status: 'RUNNING',
  startedAt: new Date('2026-05-22T10:00:00.000Z'),
}

const config = {
  id: 'cfg_1',
  userId: 'user_1',
}

describe('/api/queues/bot-manual-run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.botRunFindFirst.mockResolvedValue(run)
    mocks.botConfigFindFirst.mockResolvedValue(config)
    mocks.executeStartedBotRunForConfig.mockResolvedValue({
      runId: 'run_1',
      jobsFound: 1,
      jobsNew: 1,
      jobsApproved: 1,
      jobsHardFiltered: 0,
      jobsSkippedLowScore: 0,
      jobsEvaluationFailed: 0,
    })
  })

  it('executes an existing running BotRun from the queue message', async () => {
    const { POST } = await import('./route')
    const response = await POST(
      new Request('https://trackd.test/api/queues/bot-manual-run', {
        method: 'POST',
        body: JSON.stringify(message),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.executeStartedBotRunForConfig).toHaveBeenCalledWith(config, 'manual', {
      id: 'run_1',
      startedAt: run.startedAt,
    })
    expect(mocks.revalidateBotRunViews).toHaveBeenCalledWith('user_1')
  })

  it('does not re-execute a run that is no longer running', async () => {
    mocks.botRunFindFirst.mockResolvedValue({ ...run, status: 'COMPLETED' })

    const { POST } = await import('./route')
    const response = await POST(
      new Request('https://trackd.test/api/queues/bot-manual-run', {
        method: 'POST',
        body: JSON.stringify(message),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.executeStartedBotRunForConfig).not.toHaveBeenCalled()
  })

  it('marks the run failed if its config is gone before processing', async () => {
    mocks.botConfigFindFirst.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('https://trackd.test/api/queues/bot-manual-run', {
        method: 'POST',
        body: JSON.stringify(message),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.markStartedBotRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        botRunId: 'run_1',
        error: 'Bot configuration was deleted before the queued manual search could run.',
      })
    )
    expect(mocks.executeStartedBotRunForConfig).not.toHaveBeenCalled()
  })
})
