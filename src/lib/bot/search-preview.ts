import {
  BOT_SEARCH_KEYWORD_OR_MAX,
  BOT_SEARCH_LOCATION_PASSES_MAX,
  BOT_SEARCH_PROVIDER_PASSES_MAX,
  BOT_SEARCH_RESULTS_WANTED,
} from '@/lib/bot/search-constants'
import { buildBotSearchPassPlan } from '@/lib/bot/search-plan'
import {
  jobsSearchApiSearchHint,
  normalizeExperienceLevel,
} from '@/lib/bot/experience-level'
import { buildProviderSearchQuery } from '@/lib/bot/search-quality'
import { buildSafeSearchTerms } from '@/lib/bot/search-profile'

export type BotSearchBackends = {
  /** RapidAPI Jobs Search API — POST getjobs_excel (multi-board). */
  jobsSearchApi: boolean
}

/** Passed from the RSC page so SSR + hydration always match (avoids client bundle drift). */
export type BotSearchUiCaps = {
  keywordOrMax: number
  locationPassesMax: number
  providerPassesMax: number
  resultsTarget: number
}

/** Fallback when props are missing (stale Flight chunk / HMR); matches `search-constants`. */
export function defaultSearchUiCaps(): BotSearchUiCaps {
  return {
    keywordOrMax: BOT_SEARCH_KEYWORD_OR_MAX,
    locationPassesMax: BOT_SEARCH_LOCATION_PASSES_MAX,
    providerPassesMax: BOT_SEARCH_PROVIDER_PASSES_MAX,
    resultsTarget: BOT_SEARCH_RESULTS_WANTED,
  }
}

export type BotSearchPreviewModel = {
  hasKeywords: boolean
  keywordQuery: string
  /** Provider search terms sent as separate Jobs Search API passes. */
  providerSearchTerms: string[]
  /** Human-readable provider query summary. */
  jobsSearchPhrase: string
  providerPassesPlanned: number
  providerPassesSelected: number
  providerPassesDropped: number
  providerPassesCapped: boolean
  providerPassesPreview: { searchTerm: string; location: string }[]
  extraKeywordsDropped: number
  locationRuns: string[]
  extraLocationsDropped: number
  remoteOnly: boolean
  enabledPlatforms: string[]
  noBackends: boolean
  excludeCompanies: string[]
  excludeKeywords: string[]
  resultsTarget: number
  scoringHints: {
    minScore: number
    salaryMinUsd: number | null
    experienceLabel: string
  }
  /** How the user's experienceLevel setting is forwarded to the search backend. */
  experienceForwarding: {
    /** Keyword hint prepended to the Jobs Search API `search_term`. */
    jobsSearchApiTermPrefix: string | null
  }
}

/**
 * Describes what the bot will query (same rules as `search-client` `runSearch`).
 * Safe to run in the browser — no env reads; pass `backends` from the server.
 */
export function buildBotSearchPreview(input: {
  keywords: string[]
  locations: string[]
  remoteOnly: boolean
  experienceLabel: string
  /**
   * Raw BotConfig.experienceLevel value (e.g. `'senior_level'`). Required to
   * compute how the experience setting is forwarded to each backend — must come
   * from the same source /settings/bot saves.
   */
  experienceLevelRaw: string
  excludeCompanies: string[]
  excludeKeywords: string[]
  salaryMinUsd: number | null
  minScore: number
  backends: BotSearchBackends
  /** Server-derived safe role/stack terms from the user's Job Search resume. */
  safeResumeSearchTerms?: string[]
  /** Prefer passing from RSC; omitted values use `defaultSearchUiCaps()` so older clients don’t crash. */
  caps?: BotSearchUiCaps | null
}): BotSearchPreviewModel {
  const { keywordOrMax, locationPassesMax, providerPassesMax, resultsTarget } =
    input.caps ?? defaultSearchUiCaps()
  const kw = input.keywords.map((k) => k.trim()).filter(Boolean)
  const safeTerms = buildSafeSearchTerms({
    settingsKeywords: kw,
    resumeSearchTerms: input.safeResumeSearchTerms ?? [],
    maxTerms: keywordOrMax,
  })
  const usedKw = safeTerms.length > 0 ? safeTerms : kw.slice(0, keywordOrMax)
  const keywordQuery = usedKw.join(' OR ')
  const extraKeywordsDropped = Math.max(0, kw.length - keywordOrMax)

  const rawLocs = input.locations.map((l) => l.trim()).filter(Boolean)
  const searchPlan = buildBotSearchPassPlan({
    keywords: usedKw,
    locations: input.locations,
    remoteOnly: input.remoteOnly,
    keywordMax: keywordOrMax,
    locationMax: locationPassesMax,
    providerPassesMax,
  })
  const locationRuns = searchPlan.locations
  const extraLocationsDropped =
    rawLocs.length > 0 ? Math.max(0, rawLocs.length - locationPassesMax) : 0

  const enabledPlatforms: string[] = []
  if (input.backends.jobsSearchApi) {
    enabledPlatforms.push('Multi-board jobs (RapidAPI Jobs Search API — getjobs_excel)')
  }

  const level = normalizeExperienceLevel(input.experienceLevelRaw)
  const jobsSearchApiTermPrefix = jobsSearchApiSearchHint(level)

  const displayTerm = (term: string) => {
    const base = term.trim()
    if (!base) return ''
    return jobsSearchApiTermPrefix && !new RegExp(`\\b${jobsSearchApiTermPrefix}\\b`, 'i').test(base)
      ? `${jobsSearchApiTermPrefix} ${base}`.trim()
      : base
  }

  const displayProviderQuery = (term: string, location: string) =>
    displayTerm(
      buildProviderSearchQuery({
        searchTerm: term,
        location,
        allLocations: searchPlan.locations,
        remoteOnly: input.remoteOnly,
      }),
    )

  const providerSearchTerms = Array.from(
    new Set(
      searchPlan.passes
        .map((pass) => displayProviderQuery(pass.searchTerm, pass.location))
        .filter(Boolean),
    ),
  )
  const jobsSearchPhrase = providerSearchTerms.join(' OR ')
  const providerPassesPreview = searchPlan.passes.map((pass) => ({
    searchTerm: displayProviderQuery(pass.searchTerm, pass.location),
    location: pass.location,
  }))

  return {
    hasKeywords: usedKw.length > 0,
    keywordQuery,
    providerSearchTerms,
    jobsSearchPhrase,
    providerPassesPlanned: searchPlan.totalPossiblePasses,
    providerPassesSelected: searchPlan.passes.length,
    providerPassesDropped: searchPlan.droppedPasses,
    providerPassesCapped: searchPlan.capped,
    providerPassesPreview,
    extraKeywordsDropped,
    locationRuns,
    extraLocationsDropped,
    remoteOnly: input.remoteOnly,
    enabledPlatforms,
    noBackends: enabledPlatforms.length === 0,
    excludeCompanies: input.excludeCompanies.map((c) => c.trim()).filter(Boolean),
    excludeKeywords: input.excludeKeywords.map((k) => k.trim()).filter(Boolean),
    resultsTarget,
    scoringHints: {
      minScore: input.minScore,
      salaryMinUsd: input.salaryMinUsd,
      experienceLabel: input.experienceLabel,
    },
    experienceForwarding: {
      jobsSearchApiTermPrefix,
    },
  }
}
