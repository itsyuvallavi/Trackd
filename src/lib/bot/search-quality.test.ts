import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildProviderSearchQuery,
  resolveJobsSearchCountryIndeed,
  resolveJobsSearchLinkedinFetchDescription,
  resolveJobsSearchRemoteFlag,
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

  it('marks remote-region provider passes as remote even when remote-only is off', () => {
    expect(resolveJobsSearchRemoteFlag({ location: 'Remote', remoteOnly: false })).toBe(true)
    expect(resolveJobsSearchRemoteFlag({ location: 'Europe', remoteOnly: false })).toBe(true)
    expect(resolveJobsSearchRemoteFlag({ location: 'EU', remoteOnly: false })).toBe(true)
    expect(resolveJobsSearchRemoteFlag({ location: 'Lisbon', remoteOnly: false })).toBe(false)
    expect(resolveJobsSearchRemoteFlag({ location: 'Porto', remoteOnly: false })).toBe(false)
    expect(resolveJobsSearchRemoteFlag({ location: 'Lisbon', remoteOnly: true })).toBe(true)
  })

  it('derives country_indeed from the pass or wider profile instead of defaulting Europe to USA', () => {
    expect(
      resolveJobsSearchCountryIndeed({
        location: 'Lisbon',
        allLocations: ['Remote', 'Lisbon', 'Europe', 'Porto', 'EU'],
      }),
    ).toEqual({ countryIndeed: 'Portugal', reason: 'location_pass' })

    expect(
      resolveJobsSearchCountryIndeed({
        location: 'Remote',
        allLocations: ['Remote', 'Lisbon', 'Europe', 'Porto', 'EU'],
      }),
    ).toEqual({ countryIndeed: 'Portugal', reason: 'profile_scope' })

    expect(
      resolveJobsSearchCountryIndeed({
        location: 'Remote Europe',
        allLocations: ['Remote Europe'],
      }),
    ).toEqual({ countryIndeed: 'Portugal', reason: 'europe_default' })

    expect(
      resolveJobsSearchCountryIndeed({
        location: 'Remote Europe',
        allLocations: ['Remote Europe', 'Dublin'],
      }),
    ).toEqual({ countryIndeed: 'Portugal', reason: 'europe_default' })

    expect(
      resolveJobsSearchCountryIndeed({
        location: 'Dublin',
        allLocations: ['Remote Europe', 'Dublin'],
      }),
    ).toEqual({ countryIndeed: 'Ireland', reason: 'location_pass' })

    expect(
      resolveJobsSearchCountryIndeed({
        location: 'United States',
        allLocations: ['United States'],
      }),
    ).toEqual({ countryIndeed: 'USA', reason: 'location_pass' })
  })

  it('honors explicit country and LinkedIn description env overrides', () => {
    vi.stubEnv('JOBS_SEARCH_COUNTRY_INDEED', 'Spain')
    vi.stubEnv('JOBS_SEARCH_LINKEDIN_DESC', '0')

    expect(
      resolveJobsSearchCountryIndeed({
        location: 'Lisbon',
        allLocations: ['Portugal'],
      }),
    ).toEqual({ countryIndeed: 'Spain', reason: 'env_override' })
    expect(resolveJobsSearchLinkedinFetchDescription(['linkedin'])).toBe(false)
  })
})
