import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult } from './types'

const chatCompletionMock = vi.fn()
const findManyMock = vi.fn()

vi.mock('@/lib/ai/client', () => ({
  getAIClient: () => ({
    chatCompletion: chatCompletionMock,
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botResume: {
      findMany: findManyMock,
    },
  },
}))

function cfg(partial: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg-1',
    userId: 'user-1',
    keywords: ['Frontend Engineer'],
    locations: [],
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: [],
    remoteOnly: false,
    experienceLevel: 'any',
    salaryMin: null,
    isActive: true,
    searchFrequency: 'DAILY',
    lastSearchAt: null,
    telegramChatId: null,
    minScore: 90,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...partial,
  } as BotConfig
}

function job(partial: Partial<SearchJobResult> = {}): SearchJobResult {
  return {
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    url: 'https://example.com/job',
    description:
      'Build product interfaces with TypeScript, React, accessibility, API integrations, and testing. The role works with designers and backend engineers on customer-facing workflow features.',
    source: 'jsearch',
    is_remote: true,
    ...partial,
  }
}

describe('evaluateJob minScore behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMock.mockResolvedValue([])
  })

  it('does not boost a raw model score to bypass the user minimum', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 45,
                reasoning: 'The title says "Frontend Engineer", but the fit is only partial.',
                shouldApply: false,
                flags: [],
                resumeMatch: 'no resume',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(job(), cfg({ minScore: 90 }))

    expect(result.evaluation.score).toBe(45)
    expect(result.evaluation.shouldApply).toBe(false)
    expect(result.evaluation.flags).not.toContain('clamp_pass_boost')
  })
})
