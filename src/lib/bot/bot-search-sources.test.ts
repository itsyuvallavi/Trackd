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

  it('uses Jobs Search API when no allowlist is configured', () => {
    vi.stubEnv('JOBS_SEARCH_API_KEY', 'jobs-search-key')
    vi.stubEnv('BOT_SEARCH_SOURCES', '')

    expect(effectiveSearchBackends()).toEqual({
      jobsSearchApi: true,
    })
    expect(effectiveSearchBackendLabels()).toEqual(['Jobs Search API (getjobs_excel)'])
    expect(botSearchHasQueryableBackend()).toBe(true)
  })

  it('applies BOT_SEARCH_SOURCES to the same backend model used by the settings preview', () => {
    vi.stubEnv('JOBS_SEARCH_API_KEY', 'jobs-search-key')
    vi.stubEnv('BOT_SEARCH_SOURCES', 'jobs_search_api')

    expect(effectiveSearchBackends()).toEqual({
      jobsSearchApi: true,
    })
    expect(effectiveSearchBackendLabels()).toEqual(['Jobs Search API (getjobs_excel)'])
    expect(botSearchHasQueryableBackend()).toBe(true)
  })

  it('reports no backend when the allowlist has no supported sources', () => {
    vi.stubEnv('JOBS_SEARCH_API_KEY', 'jobs-search-key')
    vi.stubEnv('BOT_SEARCH_SOURCES', 'jsearch')

    expect(effectiveSearchBackends()).toEqual({
      jobsSearchApi: false,
    })
    expect(effectiveSearchBackendLabels()).toEqual([])
    expect(botSearchHasQueryableBackend()).toBe(false)
  })
})
