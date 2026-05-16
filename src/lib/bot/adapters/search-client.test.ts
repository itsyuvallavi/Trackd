import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchJobResult } from '../types'

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

  it('passes keywords, locations, remote, excludes, and seniority settings to adapters', async () => {
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

    expect(searchJobsSearchApiExcelMock).toHaveBeenCalledTimes(2)
    expect(searchJobsSearchApiExcelMock.mock.calls[0][0]).toMatchObject({
      searchTerm: 'Frontend Engineer Backend Engineer remote',
      location: 'Portugal',
      isRemote: true,
      experienceHint: 'senior',
    })

    expect(response.jobs.map((job) => job.url)).toEqual(['https://example.com/jobs-search'])
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
