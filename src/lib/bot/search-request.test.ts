import { describe, expect, it } from 'vitest'
import type { BotConfig } from '@prisma/client'
import { BOT_SEARCH_RESULTS_WANTED } from './search-constants'
import { buildBotSearchRequest } from './search-request'

function config(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg_1',
    userId: 'user_1',
    keywords: ['Frontend Engineer', 'React'],
    locations: ['Tel Aviv', 'Remote Europe'],
    excludeCompanies: ['Blocked Co'],
    excludeKeywords: ['PHP'],
    spokenLanguages: ['en'],
    remoteOnly: true,
    experienceLevel: 'senior_level',
    salaryMin: null,
    searchFrequency: 'DAILY',
    isActive: true,
    minScore: 70,
    lastSearchAt: null,
    telegramChatId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('buildBotSearchRequest', () => {
  it('forwards saved bot settings into the search request', () => {
    expect(buildBotSearchRequest(config())).toEqual({
      keywords: ['Frontend Engineer', 'React'],
      locations: ['Tel Aviv', 'Remote Europe'],
      remote_only: true,
      exclude_companies: ['Blocked Co'],
      exclude_keywords: ['PHP'],
      results_wanted: BOT_SEARCH_RESULTS_WANTED,
      experience_level: 'senior_level',
    })
  })

  it('falls back to Remote when no search locations are configured', () => {
    expect(buildBotSearchRequest(config({ locations: [], remoteOnly: false }))).toMatchObject({
      locations: ['Remote'],
      remote_only: false,
    })
  })

  it('uses safe profile terms as request keywords when provided', () => {
    expect(
      buildBotSearchRequest(config(), {
        terms: ['React TypeScript Developer', 'Next.js Frontend Engineer'],
      })
    ).toEqual({
      keywords: ['React TypeScript Developer', 'Next.js Frontend Engineer'],
      locations: ['Tel Aviv', 'Remote Europe'],
      remote_only: true,
      exclude_companies: ['Blocked Co'],
      exclude_keywords: ['PHP'],
      results_wanted: BOT_SEARCH_RESULTS_WANTED,
      experience_level: 'senior_level',
    })
  })

  it('falls back to saved keywords when safe profile has no terms', () => {
    expect(buildBotSearchRequest(config(), { terms: [] }).keywords).toEqual([
      'Frontend Engineer',
      'React',
    ])
  })

  it('preserves an unset experience level as null for adapter-specific handling', () => {
    expect(buildBotSearchRequest(config({ experienceLevel: null })).experience_level).toBeNull()
  })
})
