import { describe, expect, it } from 'vitest'

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
      'senior Product Manager',
      'senior Product Owner',
    ])
    expect(preview.jobsSearchPhrase).toBe('senior Product Manager OR senior Product Owner')
    expect(preview.locationRuns).toEqual(['Remote', 'USA'])
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
})
