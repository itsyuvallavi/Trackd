import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  botSearchHasQueryableBackend,
  effectiveSearchBackendLabels,
  effectiveSearchBackends,
} from './bot-search-sources'

describe('bot search source selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses every keyed backend when no allowlist is configured', () => {
    vi.stubEnv('JSEARCH_API_KEY', 'jsearch-key')
    vi.stubEnv('JOBS_SEARCH_API_KEY', 'jobs-search-key')
    vi.stubEnv('BOT_SEARCH_SOURCES', '')

    expect(effectiveSearchBackends()).toEqual({
      jsearch: true,
      jobsSearchApi: true,
    })
    expect(effectiveSearchBackendLabels()).toEqual([
      'JSearch',
      'Jobs Search API (getjobs_excel)',
    ])
    expect(botSearchHasQueryableBackend()).toBe(true)
  })

  it('applies BOT_SEARCH_SOURCES to the same backend model used by the settings preview', () => {
    vi.stubEnv('JSEARCH_API_KEY', 'jsearch-key')
    vi.stubEnv('JOBS_SEARCH_API_KEY', 'jobs-search-key')
    vi.stubEnv('BOT_SEARCH_SOURCES', 'jobs_search_api')

    expect(effectiveSearchBackends()).toEqual({
      jsearch: false,
      jobsSearchApi: true,
    })
    expect(effectiveSearchBackendLabels()).toEqual(['Jobs Search API (getjobs_excel)'])
    expect(botSearchHasQueryableBackend()).toBe(true)
  })

  it('reports no backend when the allowlist excludes the only configured key', () => {
    vi.stubEnv('JSEARCH_API_KEY', '')
    vi.stubEnv('JOBS_SEARCH_API_KEY', 'jobs-search-key')
    vi.stubEnv('BOT_SEARCH_SOURCES', 'jsearch')

    expect(effectiveSearchBackends()).toEqual({
      jsearch: false,
      jobsSearchApi: false,
    })
    expect(effectiveSearchBackendLabels()).toEqual([])
    expect(botSearchHasQueryableBackend()).toBe(false)
  })
})
