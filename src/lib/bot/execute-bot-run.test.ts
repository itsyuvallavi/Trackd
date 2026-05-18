import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotConfig } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  botRunCreate: vi.fn(),
  botRunUpdate: vi.fn(),
  botRunUpdateMany: vi.fn(),
  botRunFindFirst: vi.fn(),
  botConfigUpdate: vi.fn(),
  notificationCreate: vi.fn(),
  jobFindMany: vi.fn(),
  runBotSearch: vi.fn(),
  sendBotRunSummary: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    $executeRaw: mocks.executeRaw,
    botRun: {
      create: mocks.botRunCreate,
      update: mocks.botRunUpdate,
      updateMany: mocks.botRunUpdateMany,
      findFirst: mocks.botRunFindFirst,
    },
    botConfig: {
      update: mocks.botConfigUpdate,
    },
    notification: {
      create: mocks.notificationCreate,
    },
    job: {
      findMany: mocks.jobFindMany,
    },
  },
}))

vi.mock('@/lib/bot/search-orchestrator', () => ({
  runBotSearch: mocks.runBotSearch,
}))

vi.mock('@/lib/bot/telegram', () => ({
  sendBotRunSummary: mocks.sendBotRunSummary,
}))

function config(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg_1',
    userId: 'user_1',
    keywords: ['Frontend Engineer'],
    locations: ['Remote'],
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: ['English'],
    remoteOnly: true,
    experienceLevel: 'mid_level',
    salaryMin: null,
    searchFrequency: 'DAILY',
    isActive: true,
    lastSearchAt: null,
    telegramChatId: null,
    minScore: 75,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as BotConfig
}

function orchestratorResult(overrides = {}) {
  return {
    jobsFound: 3,
    jobsNew: 1,
    jobsEvaluated: 2,
    jobsApproved: 1,
    jobsEvaluationFailed: 0,
    jobsSaveFailed: 0,
    jobsHardFiltered: 0,
    jobsSkippedLowScore: 1,
    skippedExistingByUrl: 0,
    skippedExistingByTitle: 0,
    skippedBatchDuplicate: 0,
    skippedPreviouslyDismissed: 0,
    errors: {},
    evaluationSkips: [],
    evaluationFailures: [],
    platformsMeta: null,
    ...overrides,
  }
}

describe('executeBotRunForConfig Telegram routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $executeRaw: mocks.executeRaw,
        botRun: {
          create: mocks.botRunCreate,
          update: mocks.botRunUpdate,
          updateMany: mocks.botRunUpdateMany,
          findFirst: mocks.botRunFindFirst,
        },
      }),
    )
    mocks.executeRaw.mockResolvedValue(1)
    mocks.botRunCreate.mockResolvedValue({ id: 'run_1' })
    mocks.botRunUpdate.mockResolvedValue({})
    mocks.botRunUpdateMany.mockResolvedValue({ count: 0 })
    mocks.botRunFindFirst.mockResolvedValue(null)
    mocks.botConfigUpdate.mockResolvedValue({})
    mocks.notificationCreate.mockResolvedValue({})
    mocks.jobFindMany.mockResolvedValue([])
    mocks.runBotSearch.mockResolvedValue(orchestratorResult())
    mocks.sendBotRunSummary.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not send Telegram summaries from a global env fallback when config chat ID is null', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', 'global-test-chat')

    const { executeBotRunForConfig } = await import('./execute-bot-run')
    await executeBotRunForConfig(config({ telegramChatId: null }), 'manual')

    expect(mocks.jobFindMany).not.toHaveBeenCalled()
    expect(mocks.sendBotRunSummary).not.toHaveBeenCalled()
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user_1',
          type: 'SYNC_COMPLETE',
          title: 'Job search complete',
          actionUrl: '/bot/runs',
          metadata: expect.objectContaining({ kind: 'bot_run', botRunId: 'run_1' }),
        }),
      }),
    )
  })

  it('expires stale running rows before creating a fresh run', async () => {
    const { executeBotRunForConfig } = await import('./execute-bot-run')
    await executeBotRunForConfig(config(), 'manual')

    expect(mocks.botRunUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        botConfigId: 'cfg_1',
        status: 'RUNNING',
        startedAt: { lt: expect.any(Date) },
      },
      data: expect.objectContaining({
        status: 'FAILED',
        completedAt: expect.any(Date),
        duration: 10 * 60 * 1000,
        errors: expect.objectContaining({
          stale: true,
          fatal: expect.stringContaining('runtime budget'),
        }),
      }),
    })
    expect(mocks.botRunUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.botRunCreate.mock.invocationCallOrder[0],
    )
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1)
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.botRunFindFirst.mock.invocationCallOrder[0],
    )
  })

  it('does not start a duplicate run while a fresh run is already active', async () => {
    mocks.botRunFindFirst.mockResolvedValue({ id: 'run_active' })

    const { executeBotRunForConfig } = await import('./execute-bot-run')
    const result = await executeBotRunForConfig(config(), 'manual')

    expect(mocks.botRunCreate).not.toHaveBeenCalled()
    expect(mocks.runBotSearch).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      runId: 'run_active',
      error: expect.stringContaining('already running'),
    })
  })

  it('sends Telegram summaries only to the explicit chat ID saved on the user config', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', 'global-test-chat')
    mocks.jobFindMany.mockResolvedValue([
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        url: 'https://example.com/job',
        notes: 'AI score 91/100',
      },
    ])

    const { executeBotRunForConfig } = await import('./execute-bot-run')
    await executeBotRunForConfig(config({ telegramChatId: 'user-chat-123' }), 'cron')

    expect(mocks.sendBotRunSummary).toHaveBeenCalledTimes(1)
    expect(mocks.sendBotRunSummary).toHaveBeenCalledWith(
      'user-chat-123',
      expect.objectContaining({
        jobsFound: 3,
        jobsNew: 1,
        jobsApproved: 1,
        hardFiltered: 0,
        minScore: 75,
      }),
    )
  })

  it('marks all-evaluator-failed runs failed and creates an error notification', async () => {
    mocks.runBotSearch.mockResolvedValue(
      orchestratorResult({
        jobsFound: 3,
        jobsNew: 0,
        jobsEvaluated: 0,
        jobsApproved: 0,
        jobsEvaluationFailed: 3,
        jobsSkippedLowScore: 0,
        evaluationFailures: [
          { title: 'Frontend Engineer', company: 'Acme', error: 'provider request timed out' },
        ],
      }),
    )

    const { executeBotRunForConfig } = await import('./execute-bot-run')
    await executeBotRunForConfig(config(), 'manual')

    expect(mocks.botRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run_1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errors: expect.objectContaining({
            evaluationFailed: '3 listing(s) could not be scored',
            evaluationFailures: [
              { title: 'Frontend Engineer', company: 'Acme', error: 'provider request timed out' },
            ],
          }),
        }),
      }),
    )
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SYNC_ERROR',
          title: 'Job search could not score jobs',
          message: expect.stringContaining('3 could not be scored'),
          actionUrl: '/bot/runs',
        }),
      }),
    )
  })

  it('marks fatal orchestrator errors failed instead of reporting a clean no-match run', async () => {
    mocks.runBotSearch.mockResolvedValue(
      orchestratorResult({
        jobsFound: 0,
        jobsNew: 0,
        jobsEvaluated: 0,
        jobsApproved: 0,
        jobsSkippedLowScore: 0,
        errors: { search: 'All configured search providers failed: timeout' },
        fatalError: 'All configured search providers failed: timeout',
      }),
    )

    const { executeBotRunForConfig } = await import('./execute-bot-run')
    const result = await executeBotRunForConfig(config(), 'manual')

    expect(result).toMatchObject({
      error: 'All configured search providers failed: timeout',
    })
    expect(mocks.botRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run_1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errors: expect.objectContaining({
            search: 'All configured search providers failed: timeout',
            fatal: 'All configured search providers failed: timeout',
          }),
        }),
      }),
    )
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SYNC_ERROR',
          title: 'Job search failed',
          message: expect.stringContaining('All configured search providers failed'),
        }),
      }),
    )
  })
})
