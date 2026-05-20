import { describe, expect, it } from 'vitest'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult } from './types'
import { preFilterJob } from './pre-filter'

function config(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg_1',
    userId: 'user_1',
    keywords: ['Product Designer'],
    locations: ['Remote Europe', 'Copenhagen'],
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: ['English'],
    remoteOnly: false,
    experienceLevel: 'mid_level',
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

function job(overrides: Partial<SearchJobResult> = {}): SearchJobResult {
  return {
    title: 'Product Designer',
    company: 'Acme',
    location: 'Copenhagen, Denmark',
    url: 'https://example.com/job',
    description: 'Design product workflows and prototypes.',
    source: 'jobs_search_api',
    jobBoard: 'linkedin',
    is_remote: false,
    ...overrides,
  }
}

describe('preFilterJob', () => {
  it('rejects title-level base-location/relocation constraints before trusting provider location metadata', () => {
    const result = preFilterJob(
      job({
        title: 'Senior Product Designer - Flights (Bangkok - Based, Relocation Provided)',
        location: 'Amsterdam, North Holland, Netherlands',
        is_remote: true,
      }),
      config()
    )

    expect(result).toMatchObject({
      rejected: true,
      flag: 'wrong_location',
      score: 20,
    })
    expect(result.rejected && result.reason).toContain('bangkok')
  })

  it('allows base-location wording when it names a listed target city', () => {
    expect(
      preFilterJob(
        job({
          title: 'Product Designer (Copenhagen - Based)',
          location: 'Copenhagen, Capital Region of Denmark, Denmark',
        }),
        config()
      )
    ).toEqual({ rejected: false })
  })

  it('does not treat prose in the description as title-level base-location evidence', () => {
    expect(
      preFilterJob(
        job({
          title: 'Frontend Engineer, Growth',
          location: 'Remote Europe',
          is_remote: true,
          description:
            "You're comfortable quickly iterating on experiments and are based in a remote-first product team.",
        }),
        config({
          keywords: ['Frontend Engineer'],
          locations: ['Remote Europe', 'Portugal', 'Lisbon'],
          remoteOnly: true,
        })
      )
    ).toEqual({ rejected: false })
  })
})
