import { describe, expect, it } from 'vitest'

import { BOT_SEARCH_PROVIDER_PASSES_MAX } from './search-constants'
import { buildBotSearchPreview } from './search-preview'

function baseInput() {
  return {
    keywords: ['Product Manager', 'Product Owner'],
    locations: ['Remote', 'USA'],
    remoteOnly: true,
    experienceLabel: 'Senior level',
    experienceLevelRaw: 'senior_level',
    excludeCompanies: [],
    excludeKeywords: [],
    salaryMinUsd: null,
    minScore: 70,
    backends: { jobsSearchApi: true },
  }
}

describe('buildBotSearchPreview', () => {
  it('shows separate provider keyword passes instead of one joined phrase', () => {
    const preview = buildBotSearchPreview(baseInput())

    expect(preview.keywordQuery).toBe('Product Manager OR Product Owner')
    expect(preview.providerSearchTerms).toEqual([
      'senior Product Manager remote',
      'senior Product Owner remote',
      'senior Product Manager remote United States',
      'senior Product Owner remote United States',
    ])
    expect(preview.jobsSearchPhrase).toBe(
      'senior Product Manager remote OR senior Product Owner remote OR senior Product Manager remote United States OR senior Product Owner remote United States'
    )
    expect(preview.locationRuns).toEqual(['Remote', 'USA'])
    expect(preview.providerPassesPlanned).toBe(4)
    expect(preview.providerPassesSelected).toBe(4)
    expect(preview.providerPassesCapped).toBe(false)
  })

  it('uses a remote provider term when a remote-only search has no keywords yet', () => {
    const preview = buildBotSearchPreview({
      ...baseInput(),
      keywords: [],
      locations: [],
      remoteOnly: true,
      experienceLevelRaw: '',
    })

    expect(preview.hasKeywords).toBe(false)
    expect(preview.providerSearchTerms).toEqual(['remote'])
    expect(preview.jobsSearchPhrase).toBe('remote')
  })

  it('refines broad developer keywords into provider terms with stronger stack intent', () => {
    const preview = buildBotSearchPreview({
      ...baseInput(),
      keywords: ['Fullstack Developer', 'React Developer', 'Frontend Developer', 'AI Engineer'],
      locations: ['Remote'],
      remoteOnly: false,
      experienceLevelRaw: '',
    })

    expect(preview.keywordQuery).toBe(
      'Full Stack Engineer OR React TypeScript Developer OR Frontend Engineer OR LLM Engineer'
    )
    expect(preview.providerSearchTerms).toEqual([
      'Full Stack Engineer remote',
      'React TypeScript Developer remote',
      'Frontend Engineer remote',
      'LLM Engineer remote',
    ])
  })

  it('previews resume-derived safe search terms instead of raw saved keywords', () => {
    const preview = buildBotSearchPreview({
      ...baseInput(),
      keywords: ['React Developer'],
      safeResumeSearchTerms: [
        'React TypeScript Developer',
        'Next.js Frontend Engineer',
        'LLM Engineer',
      ],
      locations: ['Remote Europe'],
      remoteOnly: true,
      experienceLevelRaw: '',
    })

    expect(preview.keywordQuery).toBe(
      'React TypeScript Developer OR Next.js Frontend Engineer'
    )
    expect(preview.providerSearchTerms).toEqual([
      'React TypeScript Developer remote Europe',
      'Next.js Frontend Engineer remote Europe',
    ])
    expect(preview.jobsSearchPhrase).not.toContain('React Developer')
  })

  it('previews broader QA aliases from resume-derived safe search terms', () => {
    const preview = buildBotSearchPreview({
      ...baseInput(),
      keywords: ['QA Automation Engineer'],
      safeResumeSearchTerms: [
        'QA Automation Engineer',
        'QA Engineer',
        'Test Automation Engineer',
        'SDET',
        'Playwright QA Engineer',
      ],
      locations: ['Remote Europe'],
      remoteOnly: true,
      experienceLevelRaw: '',
    })

    expect(preview.keywordQuery).toBe(
      'QA Automation Engineer OR QA Engineer OR Test Automation Engineer OR SDET OR Playwright QA Engineer'
    )
    expect(preview.providerSearchTerms).toEqual([
      'QA Automation Engineer remote Europe',
      'QA Engineer remote Europe',
      'Test Automation Engineer remote Europe',
      'SDET remote Europe',
      'Playwright QA Engineer remote Europe',
    ])
    expect(preview.jobsSearchPhrase).not.toContain('Software Engineer in Test')
  })

  it('exposes capped provider passes with balanced keyword and location coverage', () => {
    const preview = buildBotSearchPreview({
      ...baseInput(),
      keywords: ['K1', 'K2', 'K3', 'K4', 'K5'],
      locations: ['L1', 'L2', 'L3', 'L4', 'L5'],
      experienceLevelRaw: '',
    })

    expect(preview.providerPassesPlanned).toBe(25)
    expect(preview.providerPassesSelected).toBe(BOT_SEARCH_PROVIDER_PASSES_MAX)
    expect(preview.providerPassesDropped).toBe(15)
    expect(preview.providerPassesCapped).toBe(true)
    expect(new Set(preview.providerPassesPreview.map((pass) => pass.searchTerm)).size)
      .toBeGreaterThan(1)
    expect(new Set(preview.providerPassesPreview.map((pass) => pass.location)).size)
      .toBeGreaterThan(1)
    expect(preview.providerPassesPreview.every((pass) => pass.location === 'L1')).toBe(false)
  })

  it('keeps keyword/location dropped counts separate from provider-pass caps', () => {
    const preview = buildBotSearchPreview({
      ...baseInput(),
      keywords: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
      locations: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'],
      experienceLevelRaw: '',
    })

    expect(preview.extraKeywordsDropped).toBe(1)
    expect(preview.extraLocationsDropped).toBe(1)
    expect(preview.providerPassesPlanned).toBe(25)
    expect(preview.providerPassesDropped).toBe(15)
  })
})
