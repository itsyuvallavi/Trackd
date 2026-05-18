import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildProviderSearchQuery,
  resolveJobsSearchSiteNames,
} from './search-quality'

describe('Job Search provider quality helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses mainstream Europe boards for EU/Portugal searches', () => {
    expect(
      resolveJobsSearchSiteNames({
        locations: ['Remote', 'Lisbon', 'Europe', 'Porto', 'EU'],
        remoteOnly: false,
      }),
    ).toEqual({
      siteNames: ['linkedin', 'glassdoor'],
      reason: 'europe_scope',
    })
  })

  it('uses regional boards only when the user targets those regions', () => {
    expect(resolveJobsSearchSiteNames({ locations: ['India'], remoteOnly: false })).toEqual({
      siteNames: ['linkedin', 'glassdoor', 'naukri'],
      reason: 'india_or_apac_scope',
    })

    expect(resolveJobsSearchSiteNames({ locations: ['Dubai'], remoteOnly: false })).toEqual({
      siteNames: ['linkedin', 'glassdoor', 'bayt'],
      reason: 'middle_east_scope',
    })
  })

  it('honors explicit board env overrides', () => {
    vi.stubEnv('JOBS_SEARCH_SITE_NAMES', 'linkedin, bayt')

    expect(resolveJobsSearchSiteNames({ locations: ['Europe'], remoteOnly: true })).toEqual({
      siteNames: ['linkedin', 'bayt'],
      reason: 'env_override',
    })
  })

  it('adds remote and geography qualifiers to broad provider terms', () => {
    expect(
      buildProviderSearchQuery({
        searchTerm: 'Frontend Developer',
        location: 'Remote',
        allLocations: ['Remote', 'Europe', 'EU'],
        remoteOnly: false,
      }),
    ).toBe('Frontend Developer remote Europe')

    expect(
      buildProviderSearchQuery({
        searchTerm: 'React Developer',
        location: 'Lisbon',
        allLocations: ['Lisbon'],
        remoteOnly: true,
      }),
    ).toBe('React Developer remote Lisbon')
  })

  it('does not duplicate qualifiers already present in the term', () => {
    expect(
      buildProviderSearchQuery({
        searchTerm: 'Remote Europe Frontend Developer',
        location: 'Remote Europe',
        allLocations: ['Remote Europe'],
        remoteOnly: true,
      }),
    ).toBe('Remote Europe Frontend Developer')
  })
})
