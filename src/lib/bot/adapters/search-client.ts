/**
 * Unified job search client (RapidAPI job sources).
 *
 * Sources (configured by env vars present):
 *   1. JSearch — JSEARCH_API_KEY
 *   2. Jobs Search API — JOBS_SEARCH_API_KEY, else JSEARCH (POST getjobs_excel, multi-board)
 *
 * Optional: `BOT_SEARCH_SOURCES` — comma-separated allowlist, e.g. `jsearch,jobs_search_api`.
 *
 * RapidAPI providers: if a call returns a terminal error (403 not subscribed,
 * legacy shutdown message), remaining location passes for that provider are skipped in the
 * same run to save time and log noise.
 */

import type { SearchRequest, SearchResponse, SearchJobResult } from '../types'
import {
  BOT_SEARCH_KEYWORD_OR_MAX,
  BOT_SEARCH_LOCATION_PASSES_MAX,
  BOT_SEARCH_RESULTS_WANTED,
  JSEARCH_DATE_POSTED,
} from '../search-constants'
import { jobsSearchApiRapidApiKey } from '../rapidapi-jobs-search-keys'
import { searchJobsSearchApiExcel } from './jobs-search-api-adapter'
import { searchJSearch } from './jsearch-adapter'
import {
  botSearchSourceAllowed,
  botSearchSourcesAllowlist,
  type BotSearchSourceToken,
} from '../bot-search-sources'
import {
  jobsSearchApiSearchHint,
  jsearchJobRequirementsFor,
  normalizeExperienceLevel,
} from '../experience-level'

function countBySource(jobs: SearchJobResult[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const j of jobs) {
    const k = j.source || 'unknown'
    acc[k] = (acc[k] ?? 0) + 1
  }
  return acc
}

/** If true, further location passes for this provider are skipped (same outcome expected). */
function rapidApiTerminalFailure(error: string): boolean {
  if (/no longer providing|professionalnetworkdata/i.test(error)) return true
  if (/\b403\b/.test(error) && /not subscribed|forbidden/i.test(error)) return true
  return false
}

export async function runSearch(req: SearchRequest): Promise<SearchResponse> {
  const allow = botSearchSourcesAllowlist()
  const src = (t: BotSearchSourceToken) => botSearchSourceAllowed(allow, t)

  const jSearchKey = process.env.JSEARCH_API_KEY ?? ''
  const jobsSearchApiKey = jobsSearchApiRapidApiKey()

  const platformsSucceeded: string[] = []
  const platformsFailed: Record<string, string> = {}
  const allJobs: SearchJobResult[] = []

  const keywordSlice = req.keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, BOT_SEARCH_KEYWORD_OR_MAX)
  const keywordQuery = keywordSlice.join(' OR ')
  const jobsSearchPhrase = keywordSlice.join(' ')
  const rawLocs = req.locations.map((l) => l.trim()).filter(Boolean)
  const locationVariants = (rawLocs.length > 0 ? rawLocs : ['Remote']).slice(
    0,
    BOT_SEARCH_LOCATION_PASSES_MAX
  )

  const platformSlots =
    (src('jsearch') && jSearchKey ? 1 : 0) + (src('jobs_search_api') && jobsSearchApiKey ? 1 : 0)
  const budget = req.results_wanted ?? BOT_SEARCH_RESULTS_WANTED
  const combos = Math.max(1, locationVariants.length) * Math.max(1, platformSlots)
  const perCombo = Math.max(5, Math.ceil(budget / combos))

  let skipJobsSearchApi = false

  const normalizedLevel = normalizeExperienceLevel(req.experience_level)
  const jsearchJobRequirements = jsearchJobRequirementsFor(normalizedLevel) ?? undefined
  const jobsSearchExperienceHint = jobsSearchApiSearchHint(normalizedLevel)

  for (let i = 0; i < locationVariants.length; i++) {
    const location = locationVariants[i]
    const locTag = `loc:${i + 1}`

    if (src('jsearch') && jSearchKey) {
      const numPages = Math.min(5, Math.max(1, Math.ceil(perCombo / 10)))
      const { jobs, error } = await searchJSearch(
        {
          query: keywordQuery,
          location,
          remoteOnly: req.remote_only,
          numPages,
          datePosted: JSEARCH_DATE_POSTED,
          excludeJobPublishers: req.exclude_companies?.length
            ? req.exclude_companies
            : undefined,
          jobRequirements: jsearchJobRequirements,
        },
        jSearchKey
      )

      if (error && jobs.length === 0) {
        platformsFailed[`jsearch_${locTag}`] = error
      } else {
        allJobs.push(...jobs)
        if (!platformsSucceeded.includes('jsearch')) platformsSucceeded.push('jsearch')
        if (error) platformsFailed[`jsearch_partial_${locTag}`] = error
      }
    } else if (src('jsearch') && !jSearchKey && i === 0) {
      platformsFailed['jsearch'] = 'JSEARCH_API_KEY not set'
    }

    if (src('jobs_search_api') && jobsSearchApiKey && !skipJobsSearchApi) {
      const searchTerm = req.remote_only ? `${jobsSearchPhrase} remote`.trim() : jobsSearchPhrase
      const { jobs, error } = await searchJobsSearchApiExcel(
        {
          searchTerm,
          location,
          resultsWanted: perCombo,
          isRemote: !!req.remote_only,
          experienceHint: jobsSearchExperienceHint,
        },
        jobsSearchApiKey
      )

      if (error && jobs.length === 0) {
        platformsFailed[`jobs_search_api_${locTag}`] = error
        if (rapidApiTerminalFailure(error)) skipJobsSearchApi = true
      } else {
        allJobs.push(...jobs)
        if (!platformsSucceeded.includes('jobs_search_api')) {
          platformsSucceeded.push('jobs_search_api')
        }
        if (error) platformsFailed[`jobs_search_api_partial_${locTag}`] = error
      }
    } else if (src('jobs_search_api') && !jobsSearchApiKey && i === 0) {
      platformsFailed['jobs_search_api'] =
        'No RapidAPI key for Jobs Search API (JOBS_SEARCH_API_KEY or JSEARCH_API_KEY)'
    }
  }

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

  const seen = new Set<string>()
  const deduped: SearchJobResult[] = []
  for (const job of filtered) {
    const key = job.url?.trim().replace(/\/$/, '') ?? ''
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    deduped.push(job)
  }

  return {
    jobs: deduped.slice(0, req.results_wanted ?? BOT_SEARCH_RESULTS_WANTED),
    meta: {
      platforms_succeeded: platformsSucceeded,
      platforms_failed: platformsFailed,
      fallback_used: false,
      total_raw: allJobs.length,
      total_deduped: deduped.length,
      by_source_raw: countBySource(allJobs),
      by_source_deduped: countBySource(deduped),
    },
  }
}
