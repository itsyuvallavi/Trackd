import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchJobResult } from '../types'
import {
  BOT_SEARCH_PROVIDER_PASSES_MAX,
  BOT_SEARCH_RAPIDAPI_CONCURRENCY,
} from '../search-constants'

const searchJobsSearchApiExcelMock = vi.fn()

vi.mock('./jobs-search-api-adapter', () => ({
  searchJobsSearchApiExcel: searchJobsSearchApiExcelMock,
}))

function result(partial: Partial<SearchJobResult>): SearchJobResult {
  return {
    title: partial.title ?? 'Frontend Engineer',
    company: partial.company ?? 'Acme',
    location: partial.location ?? 'Remote',
    url: partial.url ?? 'https://example.com/job',
    description: partial.description ?? 'A TypeScript and React role.',
    source: partial.source ?? 'jobs_search_api',
    is_remote: partial.is_remote ?? true,
  }
}

describe('runSearch settings plumbing', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.JOBS_SEARCH_API_KEY = 'jobs-search-key'
    delete process.env.BOT_SEARCH_SOURCES
  })

  afterEach(() => {
    delete process.env.JOBS_SEARCH_API_KEY
    delete process.env.BOT_SEARCH_SOURCES
  })

  it('fans out keywords by location and passes remote, excludes, and seniority settings to adapters', async () => {
    searchJobsSearchApiExcelMock.mockResolvedValue({
      jobs: [result({ url: 'https://example.com/jobs-search', source: 'jobs_search_api' })],
    })

    const { runSearch } = await import('./search-client')
    const response = await runSearch({
      keywords: ['Frontend Engineer', 'Backend Engineer', ''],
      locations: ['Portugal', 'Remote Europe'],
      remote_only: true,
      exclude_companies: ['BlockedCo'],
      exclude_keywords: ['PHP'],
      experience_level: 'senior_level',
      results_wanted: 20,
    })

    expect(searchJobsSearchApiExcelMock).toHaveBeenCalledTimes(4)
    expect(searchJobsSearchApiExcelMock.mock.calls[0][0]).toMatchObject({
      searchTerm: 'Frontend Engineer',
      location: 'Portugal',
      resultsWanted: 5,
      isRemote: true,
      experienceHint: 'senior',
    })
    expect(searchJobsSearchApiExcelMock.mock.calls[1][0]).toMatchObject({
      searchTerm: 'Backend Engineer',
      location: 'Portugal',
      resultsWanted: 5,
      isRemote: true,
      experienceHint: 'senior',
    })
    expect(searchJobsSearchApiExcelMock.mock.calls[2][0]).toMatchObject({
      searchTerm: 'Frontend Engineer',
      location: 'Remote Europe',
      resultsWanted: 5,
      isRemote: true,
      experienceHint: 'senior',
    })
    expect(searchJobsSearchApiExcelMock.mock.calls[3][0]).toMatchObject({
      searchTerm: 'Backend Engineer',
      location: 'Remote Europe',
      resultsWanted: 5,
      isRemote: true,
      experienceHint: 'senior',
    })

    expect(response.jobs.map((job) => job.url)).toEqual(['https://example.com/jobs-search'])
  })

  it('uses a remote fallback term only when no keywords are provided', async () => {
    searchJobsSearchApiExcelMock.mockResolvedValue({
      jobs: [result({ url: 'https://example.com/remote-fallback', source: 'jobs_search_api' })],
    })

    const { runSearch } = await import('./search-client')
    await runSearch({
      keywords: ['', '  '],
      locations: [],
      remote_only: true,
      results_wanted: 10,
    })

    expect(searchJobsSearchApiExcelMock).toHaveBeenCalledTimes(1)
    expect(searchJobsSearchApiExcelMock.mock.calls[0][0]).toMatchObject({
      searchTerm: 'remote',
      location: 'Remote',
      isRemote: true,
    })
  })

  it('caps broad keyword x location fanout while preserving variety', async () => {
    searchJobsSearchApiExcelMock.mockImplementation(
      async (params: { searchTerm: string; location: string }) => ({
        jobs: [
          result({
            title: params.searchTerm,
            location: params.location,
            url: `https://example.com/${params.searchTerm}-${params.location}`.replace(
              /\s+/g,
              '-'
            ),
          }),
        ],
      })
    )

    const { runSearch } = await import('./search-client')
    const response = await runSearch({
      keywords: ['K1', 'K2', 'K3', 'K4', 'K5'],
      locations: ['L1', 'L2', 'L3', 'L4', 'L5'],
      remote_only: true,
      results_wanted: 90,
    })

    expect(searchJobsSearchApiExcelMock).toHaveBeenCalledTimes(BOT_SEARCH_PROVIDER_PASSES_MAX)

    const calls = searchJobsSearchApiExcelMock.mock.calls.map(([params]) => params)
    expect(new Set(calls.map((params) => params.searchTerm)).size).toBeGreaterThan(1)
    expect(new Set(calls.map((params) => params.location)).size).toBeGreaterThan(1)
    expect(calls.every((params) => params.location === 'L1')).toBe(false)
    expect(calls.every((params) => params.resultsWanted === 9)).toBe(true)

    expect(response.meta.search_passes).toMatchObject({
      planned: 25,
      selected: BOT_SEARCH_PROVIDER_PASSES_MAX,
      executed: BOT_SEARCH_PROVIDER_PASSES_MAX,
      max: BOT_SEARCH_PROVIDER_PASSES_MAX,
      dropped: 15,
      capped: true,
      concurrency: BOT_SEARCH_RAPIDAPI_CONCURRENCY,
    })
  })

  it('stops remaining planned passes after a terminal RapidAPI failure', async () => {
    searchJobsSearchApiExcelMock.mockResolvedValue({
      jobs: [],
      error: 'Jobs Search API HTTP 403: not subscribed',
    })

    const { runSearch } = await import('./search-client')
    const response = await runSearch({
      keywords: ['K1', 'K2', 'K3', 'K4', 'K5'],
      locations: ['L1', 'L2', 'L3', 'L4', 'L5'],
      remote_only: true,
      results_wanted: 45,
    })

    expect(searchJobsSearchApiExcelMock).toHaveBeenCalledTimes(1)
    expect(response.meta.search_passes).toMatchObject({
      planned: 25,
      selected: BOT_SEARCH_PROVIDER_PASSES_MAX,
      executed: 1,
      max: BOT_SEARCH_PROVIDER_PASSES_MAX,
      dropped: 15,
      capped: true,
      concurrency: BOT_SEARCH_RAPIDAPI_CONCURRENCY,
    })
    expect(Object.values(response.meta.platforms_failed)).toContain(
      'Jobs Search API HTTP 403: not subscribed'
    )
  })

  it('honors the source allowlist', async () => {
    process.env.BOT_SEARCH_SOURCES = 'jobs_search_api'
    searchJobsSearchApiExcelMock.mockResolvedValue({
      jobs: [result({ url: 'https://example.com/jobs-search', source: 'jobs_search_api' })],
    })

    const { runSearch } = await import('./search-client')
    const response = await runSearch({
      keywords: ['Frontend Engineer'],
      locations: ['Remote'],
      results_wanted: 10,
    })

    expect(searchJobsSearchApiExcelMock).toHaveBeenCalledTimes(1)
    expect(response.meta.platforms_succeeded).toEqual(['jobs_search_api'])
    expect(response.jobs).toHaveLength(1)
  })

  it('does not run removed JSearch source even when requested', async () => {
    process.env.BOT_SEARCH_SOURCES = 'jsearch'

    const { runSearch } = await import('./search-client')
    const response = await runSearch({
      keywords: ['Frontend Engineer'],
      locations: ['Remote'],
      results_wanted: 10,
    })

    expect(searchJobsSearchApiExcelMock).not.toHaveBeenCalled()
    expect(response.meta.platforms_succeeded).toEqual([])
    expect(response.jobs).toHaveLength(0)
  })
})
