/**
 * Unified job search client.
 *
 * Uses JSearch (LinkedIn/Indeed/Glassdoor via RapidAPI) as the primary source
 * and SerpAPI (Google Jobs) as the secondary source. Both run inside the
 * existing Next.js/Vercel environment — no separate service needed.
 *
 * Priority (configured by env vars present):
 *   1. JSearch   — JSEARCH_API_KEY
 *   2. SerpAPI   — SERP_API_KEY
 *
 * At least one key must be set for the bot to work.
 */

import type { SearchRequest, SearchResponse, SearchJobResult } from '../types'
import { searchJSearch } from './jsearch-adapter'
import { searchSerpApi } from './serpapi-adapter'

export async function runSearch(req: SearchRequest): Promise<SearchResponse> {
  const jSearchKey = process.env.JSEARCH_API_KEY ?? ''
  const serpApiKey = process.env.SERP_API_KEY ?? ''

  const platformsSucceeded: string[] = []
  const platformsFailed: Record<string, string> = {}
  const allJobs: SearchJobResult[] = []

  // Build one query string per keyword+location combination (keep to max 2 combos for API budget)
  const keywordQuery = req.keywords.slice(0, 3).join(' OR ')
  const location = req.locations[0] ?? ''

  const resultsEach = Math.ceil((req.results_wanted ?? 25) / (jSearchKey && serpApiKey ? 2 : 1))

  // ── JSearch (LinkedIn, Indeed, Glassdoor, ZipRecruiter) ─────────────────
  if (jSearchKey) {
    const { jobs, error } = await searchJSearch(
      {
        query: keywordQuery,
        location,
        remoteOnly: req.remote_only,
        numPages: Math.ceil(resultsEach / 10),
        datePosted: 'week',
        excludeJobPublishers: req.exclude_companies?.length
          ? req.exclude_companies
          : undefined,
      },
      jSearchKey
    )

    if (error && jobs.length === 0) {
      platformsFailed['jsearch'] = error
    } else {
      allJobs.push(...jobs)
      platformsSucceeded.push('jsearch')
      if (error) platformsFailed['jsearch_partial'] = error
    }
  } else {
    platformsFailed['jsearch'] = 'JSEARCH_API_KEY not set'
  }

  // ── SerpAPI (Google Jobs) ────────────────────────────────────────────────
  if (serpApiKey) {
    const { jobs, error } = await searchSerpApi(
      {
        query: keywordQuery,
        location,
        remoteOnly: req.remote_only,
        resultsWanted: resultsEach,
      },
      serpApiKey
    )

    if (error && jobs.length === 0) {
      platformsFailed['serpapi'] = error
    } else {
      allJobs.push(...jobs)
      platformsSucceeded.push('serpapi_google')
      if (error) platformsFailed['serpapi_partial'] = error
    }
  } else {
    platformsFailed['serpapi'] = 'SERP_API_KEY not set'
  }

  // Apply exclude filters (company + keyword in description)
  const filtered = allJobs.filter((job) => {
    if (req.exclude_companies?.some((c) => job.company.toLowerCase().includes(c.toLowerCase()))) {
      return false
    }
    if (req.exclude_keywords?.length && job.description) {
      const desc = job.description.toLowerCase()
      if (req.exclude_keywords.some((kw) => desc.includes(kw.toLowerCase()))) return false
    }
    return true
  })

  // Deduplicate by URL
  const seen = new Set<string>()
  const deduped: SearchJobResult[] = []
  for (const job of filtered) {
    const key = job.url?.trim().replace(/\/$/, '') ?? ''
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    deduped.push(job)
  }

  return {
    jobs: deduped.slice(0, req.results_wanted ?? 25),
    meta: {
      platforms_succeeded: platformsSucceeded,
      platforms_failed: platformsFailed,
      fallback_used: false,
      total_raw: allJobs.length,
      total_deduped: deduped.length,
    },
  }
}
