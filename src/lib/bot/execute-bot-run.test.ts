import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotConfig } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  botRunCreate: vi.fn(),
  botRunUpdate: vi.fn(),
  botConfigUpdate: vi.fn(),
  jobFindMany: vi.fn(),
  runBotSearch: vi.fn(),
  sendBotRunSummary: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botRun: {
      create: mocks.botRunCreate,
      update: mocks.botRunUpdate,
    },
    botConfig: {
      update: mocks.botConfigUpdate,
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
    jobsSkippedLowScore: 1,
    skippedExistingByUrl: 0,
    skippedExistingByTitle: 0,
    skippedBatchDuplicate: 0,
    skippedPreviouslyDismissed: 0,
    errors: {},
    evaluationSkips: [],
    platformsMeta: null,
    ...overrides,
  }
}

describe('executeBotRunForConfig Telegram routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.botRunCreate.mockResolvedValue({ id: 'run_1' })
    mocks.botRunUpdate.mockResolvedValue({})
    mocks.botConfigUpdate.mockResolvedValue({})
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
        minScore: 75,
      }),
    )
  })
})
