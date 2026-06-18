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

  it('treats Lisboa and Lisbon as the same target city before scoring', () => {
    expect(
      preFilterJob(
        job({
          title: 'Operations Manager',
          location: 'Lisboa, Lisbon, Portugal',
          description: 'Manage operations for the Lisbon office.',
        }),
        config({
          keywords: ['Operations Manager'],
          locations: ['Lisbon'],
        })
      )
    ).toEqual({ rejected: false })
  })

  it('treats user-entered Lisboa as matching Lisbon listings', () => {
    expect(
      preFilterJob(
        job({
          title: 'Product Manager',
          location: 'Lisbon, Portugal',
          description: 'Work with operations and product teams in Lisbon.',
        }),
        config({
          keywords: ['Product Manager'],
          locations: ['Lisboa'],
        })
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

  it('rejects country-limited remote roles when only broad Europe/EU remote is targeted', () => {
    const result = preFilterJob(
      job({
        title: 'Full Stack Engineer (Remote Ireland / UK)',
        location: 'Remote',
        is_remote: true,
      }),
      config({
        keywords: ['Full Stack Engineer'],
        locations: ['Remote', 'Lisbon', 'Europe', 'Porto', 'EU'],
        remoteOnly: true,
      })
    )

    expect(result).toMatchObject({
      rejected: true,
      flag: 'wrong_location',
      score: 20,
    })
    expect(result.rejected && result.reason).toContain('Broad Europe/EU remote')
  })

  it('rejects description-level country-limited anywhere roles when only broad Europe/EU remote is targeted', () => {
    const result = preFilterJob(
      job({
        title: 'Fullstack Software Engineer (x/f/m) - Claims Management',
        company: 'Alan',
        location: 'Remote',
        is_remote: true,
        description:
          'Location\nAnywhere in France, Belgium, Spain\n\nWork on claims management and refunds with product engineers across backend and frontend systems.',
      }),
      config({
        keywords: ['Full Stack Engineer'],
        locations: ['Remote', 'Lisbon', 'Europe', 'Porto', 'EU'],
        remoteOnly: true,
      })
    )

    expect(result).toMatchObject({
      rejected: true,
      flag: 'wrong_location',
      score: 20,
    })
    expect(result.rejected && result.reason).toContain('france')
    expect(result.rejected && result.reason).toContain('spain')
  })

  it('allows country-limited remote roles when that country is explicitly targeted', () => {
    expect(
      preFilterJob(
        job({
          title: 'Full Stack Engineer (Remote Ireland / UK)',
          location: 'Remote',
          is_remote: true,
        }),
        config({
          keywords: ['Full Stack Engineer'],
          locations: ['Remote Ireland', 'Dublin'],
          remoteOnly: true,
        })
      )
    ).toEqual({ rejected: false })
  })

  it('rejects mandatory language requirements before AI scoring', () => {
    const result = preFilterJob(
      job({
        title: 'Requirements Engineer - Customer Facing',
        location: 'Remote',
        is_remote: true,
        description:
          'Strong communication skills and the confidence to present to customers in German. Work with product and software teams on requirements.',
      }),
      config({
        keywords: ['Requirements Engineer'],
        locations: ['Remote', 'Europe'],
        spokenLanguages: ['English', 'Hebrew'],
        remoteOnly: true,
      })
    )

    expect(result).toMatchObject({
      rejected: true,
      flag: 'missing_required_language',
      score: 20,
    })
    expect(result.rejected && result.reason).toContain('German')
  })

  it('allows mandatory language requirements when the language is declared', () => {
    expect(
      preFilterJob(
        job({
          title: 'Customer-facing Engineer',
          location: 'Remote',
          is_remote: true,
          description:
            'Strong written and spoken English is required. Build customer-facing full-stack workflow tools.',
        }),
        config({
          keywords: ['Engineer'],
          locations: ['Remote'],
          spokenLanguages: ['English', 'Hebrew'],
          remoteOnly: true,
        })
      )
    ).toEqual({ rejected: false })
  })

  it('rejects Portuguese fluency requirements written in Portuguese', () => {
    const result = preFilterJob(
      job({
        title: 'Javascript Developer (React + Node.js)',
        company: 'Adentis Portugal',
        location: 'Porto, Portugal',
        is_remote: false,
        description:
          '2 a 4 anos de experiência profissional em desenvolvimento fullstack com React e Node.js. Exige-se fluência em português falado e escrito.',
      }),
      config({
        keywords: ['Full Stack Engineer'],
        locations: ['Remote', 'Lisbon', 'Europe', 'Porto', 'EU'],
        spokenLanguages: ['English', 'Hebrew'],
        remoteOnly: true,
      })
    )

    expect(result).toMatchObject({
      rejected: true,
      flag: 'missing_required_language',
      score: 20,
    })
    expect(result.rejected && result.reason).toContain('Portuguese')
  })
})
