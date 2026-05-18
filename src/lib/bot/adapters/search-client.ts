/**
 * Unified job search client (RapidAPI job sources).
 *
 * Source:
 *   1. Jobs Search API — JOBS_SEARCH_API_KEY (POST getjobs_excel, multi-board)
 *
 * Optional: `BOT_SEARCH_SOURCES` — comma-separated allowlist, currently `jobs_search_api`.
 *
 * RapidAPI providers: if a call returns a terminal error (403 not subscribed,
 * legacy shutdown message), remaining location passes for that provider are skipped in the
 * same run to save time and log noise.
 */

import type {
  SearchRequest,
  SearchResponse,
  SearchJobResult,
  SearchProviderPassMeta,
} from '../types'
import {
  BOT_SEARCH_RAPIDAPI_CONCURRENCY,
  BOT_SEARCH_RESULTS_WANTED,
} from '../search-constants'
import { buildBotSearchPassPlan, type BotSearchProviderPass } from '../search-plan'
import { jobsSearchApiRapidApiKey } from '../rapidapi-jobs-search-keys'
import { searchJobsSearchApiExcel } from './jobs-search-api-adapter'
import {
  botSearchSourceAllowed,
  botSearchSourcesAllowlist,
  type BotSearchSourceToken,
} from '../bot-search-sources'
import {
  jobsSearchApiSearchHint,
  normalizeExperienceLevel,
} from '../experience-level'
import {
  buildProviderSearchQuery,
  resolveJobsSearchCountryIndeed,
  resolveJobsSearchLinkedinFetchDescription,
  resolveJobsSearchRemoteFlag,
  resolveJobsSearchSiteNames,
} from '../search-quality'

function countBySource(jobs: SearchJobResult[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const j of jobs) {
    const k = j.source || 'unknown'
    acc[k] = (acc[k] ?? 0) + 1
  }
  return acc
}

function countByJobBoard(jobs: SearchJobResult[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const j of jobs) {
    const k = j.jobBoard || j.providerPass?.provider || j.source || 'unknown'
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

async function runLimited<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  shouldStop?: () => boolean
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1))
  let next = 0

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        if (shouldStop?.()) return
        const item = items[next++]
        await worker(item)
      }
    })
  )
}

export async function runSearch(req: SearchRequest): Promise<SearchResponse> {
  const allow = botSearchSourcesAllowlist()
  const src = (t: BotSearchSourceToken) => botSearchSourceAllowed(allow, t)

  const jobsSearchApiKey = jobsSearchApiRapidApiKey()

  const platformsSucceeded: string[] = []
  const platformsFailed: Record<string, string> = {}
  const allJobs: SearchJobResult[] = []

  const searchPlan = buildBotSearchPassPlan({
    keywords: req.keywords,
    locations: req.locations,
    remoteOnly: !!req.remote_only,
  })

  const platformSlots = src('jobs_search_api') && jobsSearchApiKey ? 1 : 0
  const budget = req.results_wanted ?? BOT_SEARCH_RESULTS_WANTED
  const selectedPasses = searchPlan.passes.length
  const combos = Math.max(1, selectedPasses) * Math.max(1, platformSlots)
  const perCombo = Math.max(5, Math.ceil(budget / combos))

  let skipJobsSearchApi = false
  let executedPasses = 0

  const normalizedLevel = normalizeExperienceLevel(req.experience_level)
  const jobsSearchExperienceHint = jobsSearchApiSearchHint(normalizedLevel)
  const jobsSearchSiteSelection = resolveJobsSearchSiteNames({
    locations: req.locations,
    remoteOnly: !!req.remote_only,
  })
  const linkedinFetchDescription = resolveJobsSearchLinkedinFetchDescription(
    jobsSearchSiteSelection.siteNames
  )
  const providerPasses: SearchProviderPassMeta[] = searchPlan.passes.map((pass, passIndex) => {
    const country = resolveJobsSearchCountryIndeed({
      location: pass.location,
      allLocations: searchPlan.locations,
    })

    return {
      provider: 'jobs_search_api',
      passIndex,
      searchTerm: pass.searchTerm,
      providerQuery: buildProviderSearchQuery({
        searchTerm: pass.searchTerm,
        location: pass.location,
        allLocations: searchPlan.locations,
        remoteOnly: !!req.remote_only,
      }),
      location: pass.location,
      termIndex: pass.termIndex,
      locationIndex: pass.locationIndex,
      isRemote: resolveJobsSearchRemoteFlag({
        location: pass.location,
        remoteOnly: !!req.remote_only,
      }),
      siteNames: jobsSearchSiteSelection.siteNames,
      countryIndeed: country.countryIndeed,
      countryIndeedReason: country.reason,
      linkedinFetchDescription,
      resultsWanted: perCombo,
      experienceHint: jobsSearchExperienceHint,
    }
  })

  if (src('jobs_search_api') && jobsSearchApiKey) {
    await runLimited<BotSearchProviderPass>(
      searchPlan.passes,
      BOT_SEARCH_RAPIDAPI_CONCURRENCY,
      async (pass) => {
        if (skipJobsSearchApi) return

        const locTag = `loc:${pass.locationIndex + 1}`
        const termTag = `term:${pass.termIndex + 1}`
        const passMeta = providerPasses.find(
          (p) => p.termIndex === pass.termIndex && p.locationIndex === pass.locationIndex
        )
        executedPasses++

        const { jobs, error } = await searchJobsSearchApiExcel(
          {
            searchTerm: passMeta?.providerQuery ?? pass.searchTerm,
            location: pass.location,
            resultsWanted: perCombo,
            isRemote: passMeta?.isRemote ?? !!req.remote_only,
            experienceHint: jobsSearchExperienceHint,
            countryIndeed: passMeta?.countryIndeed ?? null,
            linkedinFetchDescription,
            siteNames: jobsSearchSiteSelection.siteNames,
            providerPass: passMeta,
          },
          jobsSearchApiKey
        )

        if (error && jobs.length === 0) {
          platformsFailed[`jobs_search_api_${locTag}_${termTag}`] = error
          if (rapidApiTerminalFailure(error)) skipJobsSearchApi = true
        } else {
          allJobs.push(...jobs)
          if (!platformsSucceeded.includes('jobs_search_api')) {
            platformsSucceeded.push('jobs_search_api')
          }
          if (error) platformsFailed[`jobs_search_api_partial_${locTag}_${termTag}`] = error
        }
      },
      () => skipJobsSearchApi
    )
  } else if (src('jobs_search_api') && !jobsSearchApiKey) {
    platformsFailed['jobs_search_api'] = 'JOBS_SEARCH_API_KEY not set'
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
      search_passes: {
        planned: searchPlan.totalPossiblePasses,
        selected: selectedPasses,
        executed: executedPasses,
        max: searchPlan.maxPasses,
        dropped: searchPlan.droppedPasses,
        capped: searchPlan.capped,
        concurrency: jobsSearchApiKey && src('jobs_search_api') ? BOT_SEARCH_RAPIDAPI_CONCURRENCY : 0,
      },
      provider_passes: providerPasses,
      provider_site_names: {
        jobs_search_api: jobsSearchSiteSelection.siteNames,
        reason: jobsSearchSiteSelection.reason,
      },
      provider_country_indeed: {
        jobs_search_api: Array.from(
          new Set(providerPasses.map((pass) => pass.countryIndeed).filter(Boolean) as string[])
        ),
        reason: Array.from(
          new Set(
            providerPasses
              .map((pass) => pass.countryIndeedReason)
              .filter(Boolean) as string[]
          )
        ).join(','),
      },
      query_strategy:
        'keyword_location_query_v3: provider search_term includes remote/location qualifier; is_remote and country_indeed are pass-aware',
      by_source_raw: countBySource(allJobs),
      by_source_deduped: countBySource(deduped),
      by_job_board_raw: countByJobBoard(allJobs),
      by_job_board_deduped: countByJobBoard(deduped),
    },
  }
}
