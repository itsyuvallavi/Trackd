import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotSearchFrequency } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  botConfigUpsert: vi.fn(),
  botConfigFindUnique: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  verifyTelegramChatId: vi.fn(),
  executeBotRunForConfig: vi.fn(),
  botSearchHasQueryableBackend: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botConfig: {
      upsert: mocks.botConfigUpsert,
      findUnique: mocks.botConfigFindUnique,
    },
  },
}))

vi.mock('@/lib/bot/telegram', () => ({
  verifyTelegramChatId: mocks.verifyTelegramChatId,
}))

vi.mock('@/lib/bot/execute-bot-run', () => ({
  executeBotRunForConfig: mocks.executeBotRunForConfig,
}))

vi.mock('@/lib/bot/bot-search-sources', () => ({
  botSearchHasQueryableBackend: mocks.botSearchHasQueryableBackend,
}))

function form(overrides: Partial<import('./bot-actions').BotConfigFormData> = {}) {
  return {
    keywords: ['Frontend Engineer'],
    locations: ['Remote'],
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: ['English'],
    remoteOnly: true,
    experienceLevel: 'mid_level',
    salaryMin: 120000,
    isActive: true,
    searchFrequency: 'DAILY' as BotSearchFrequency,
    telegramChatId: '',
    minScore: 75,
    ...overrides,
  }
}

describe('bot settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'user_1', email: 'user@example.com' })
    mocks.botConfigUpsert.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not persist the server-wide Telegram chat ID when the user leaves chat ID blank', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', 'global-test-chat')

    const { saveBotConfig } = await import('./bot-actions')
    await saveBotConfig(form({ telegramChatId: '   ' }))

    expect(mocks.botConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user_1',
          telegramChatId: null,
        }),
        update: expect.objectContaining({
          telegramChatId: null,
        }),
      }),
    )
  })

  it('persists only the explicit per-user Telegram chat ID', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', 'global-test-chat')

    const { saveBotConfig } = await import('./bot-actions')
    await saveBotConfig(form({ telegramChatId: '  user-chat-123  ' }))

    expect(mocks.botConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user_1',
          telegramChatId: 'user-chat-123',
        }),
        update: expect.objectContaining({
          telegramChatId: 'user-chat-123',
        }),
      }),
    )
  })

  it('coerces twice-daily scheduling to daily on the current Vercel Hobby scheduler', async () => {
    const { saveBotConfig } = await import('./bot-actions')
    await saveBotConfig(form({ searchFrequency: 'TWICE_DAILY' as BotSearchFrequency }))

    expect(mocks.botConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          searchFrequency: 'DAILY',
        }),
        update: expect.objectContaining({
          searchFrequency: 'DAILY',
        }),
      }),
    )
  })

  it('returns manual run counters so zero-save searches are visible to the UI', async () => {
    mocks.botConfigFindUnique.mockResolvedValue({
      id: 'cfg_1',
      userId: 'user_1',
      keywords: ['Frontend Engineer'],
    })
    mocks.botSearchHasQueryableBackend.mockReturnValue(true)
    mocks.executeBotRunForConfig.mockResolvedValue({
      runId: 'run_1',
      jobsFound: 33,
      jobsNew: 0,
      jobsApproved: 0,
      jobsHardFiltered: 25,
      jobsSkippedLowScore: 27,
      jobsEvaluationFailed: 0,
    })

    const { triggerBotSearch } = await import('./bot-actions')
    await expect(triggerBotSearch()).resolves.toEqual({
      success: true,
      runId: 'run_1',
      jobsFound: 33,
      jobsNew: 0,
      jobsApproved: 0,
      jobsHardFiltered: 25,
      jobsSkippedLowScore: 27,
      jobsEvaluationFailed: 0,
    })
  })

  it('returns persisted failed-run counters when AI scoring fails', async () => {
    mocks.botConfigFindUnique.mockResolvedValue({
      id: 'cfg_1',
      userId: 'user_1',
      keywords: ['Frontend Engineer'],
    })
    mocks.botSearchHasQueryableBackend.mockReturnValue(true)
    mocks.executeBotRunForConfig.mockResolvedValue({
      success: false,
      runId: 'run_1',
      jobsFound: 3,
      jobsNew: 0,
      jobsApproved: 0,
      jobsHardFiltered: 0,
      jobsSkippedLowScore: 0,
      jobsEvaluationFailed: 3,
      error: 'Search found jobs, but AI scoring failed for all candidates.',
    })

    const { triggerBotSearch } = await import('./bot-actions')
    await expect(triggerBotSearch()).resolves.toEqual({
      success: false,
      runId: 'run_1',
      jobsFound: 3,
      jobsNew: 0,
      jobsApproved: 0,
      jobsHardFiltered: 0,
      jobsSkippedLowScore: 0,
      jobsEvaluationFailed: 3,
      error: 'Search found jobs, but AI scoring failed for all candidates.',
    })
  })
})
