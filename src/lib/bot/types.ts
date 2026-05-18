export interface SearchProviderPassMeta {
  provider: 'jobs_search_api'
  passIndex: number
  searchTerm: string
  providerQuery: string
  location: string
  termIndex: number
  locationIndex: number
  isRemote: boolean
  siteNames: string[]
  resultsWanted: number
  experienceHint?: string | null
}

/** Raw job result from the trackd-search microservice */
export interface SearchJobResult {
  title: string
  company: string
  location?: string | null
  url?: string | null
  description?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  source: string
  posted_date?: string | null
  job_type?: string | null
  is_remote?: boolean | null
  company_logo?: string | null
  /**
   * When `source` is `jobs_search_api`, the job board for this row (Indeed, LinkedIn, …).
   * The API product is always `source`; this is only the board the Excel/JSON row came from.
   */
  jobBoard?: string | null
  /** Provider pass provenance for diagnostics and run audit JSON. */
  providerPass?: SearchProviderPassMeta | null
}

export interface SearchMeta {
  platforms_succeeded: string[]
  platforms_failed: Record<string, string>
  fallback_used: boolean
  total_raw: number
  total_deduped: number
  /** Provider pass planning/execution details for keyword x location fanout. */
  search_passes?: {
    planned: number
    selected: number
    executed: number
    max: number
    dropped: number
    capped: boolean
    concurrency: number
  }
  provider_passes?: SearchProviderPassMeta[]
  provider_site_names?: {
    jobs_search_api?: string[]
    reason?: string
  }
  query_strategy?: string
  /** Counts by `job.source` after all platforms merged, before exclude filters and dedup. */
  by_source_raw: Record<string, number>
  /** Counts by `job.source` after exclude filters + URL dedup (full list before `results_wanted` slice). */
  by_source_deduped: Record<string, number>
  /** Counts by provider job board after all platforms merged, before exclude filters and dedup. */
  by_job_board_raw?: Record<string, number>
  /** Counts by provider job board after exclude filters + URL dedup. */
  by_job_board_deduped?: Record<string, number>
}

export interface SearchResponse {
  jobs: SearchJobResult[]
  meta: SearchMeta
}

export interface SearchRequest {
  keywords: string[]
  locations: string[]
  remote_only?: boolean
  exclude_companies?: string[]
  exclude_keywords?: string[]
  results_wanted?: number
  experience_level?: string | null
  proxy?: string | null
}

export interface JobEvaluation {
  score: number           // 0-100
  reasoning: string       // Short explanation
  shouldApply: boolean    // true if score >= threshold
  flags: string[]         // e.g. ["salary_low", "overqualified", "good_match"]
  /** Model line about which resume lines matched (when returned in JSON). */
  resumeMatch?: string
}

/** Persisted on BotRun.errors for jobs scored but not saved (audit trail). */
export interface EvaluationSkipAudit {
  title: string
  company: string
  score: number
  minScore: number
  flags: string[]
  reasoning: string
  resumeMatch?: string
  filterKind?: 'hard_filter' | 'ai_score'
  jobBoard?: string | null
  providerPass?: SearchProviderPassMeta | null
}

export interface EvaluationFailureAudit {
  title: string
  company: string
  error: string
}

export interface OrchestratorResult {
  jobsFound: number
  jobsNew: number
  jobsEvaluated: number
  jobsApproved: number
  /** Listings rejected by deterministic code before model scoring. */
  jobsHardFiltered: number
  /** Listings that could not be evaluated because the AI/provider request failed. */
  jobsEvaluationFailed: number
  /** Saved candidates that were not persisted because AI score &lt; minScore */
  jobsSkippedLowScore: number
  /** Had same normalized URL as a row already in the DB for this user */
  skippedExistingByUrl: number
  /** Same company + title as a row already in the DB (any status) */
  skippedExistingByTitle: number
  /** Duplicate company + title within this search batch */
  skippedBatchDuplicate: number
  /** Matched a fingerprint saved when the user deleted this job earlier */
  skippedPreviouslyDismissed: number
  errors: Record<string, string>
  /** Below minScore after OpenAI eval — inspect flags/reasoning in UI or DB */
  evaluationSkips: EvaluationSkipAudit[]
  /** Evaluation failures — inspect errors when provider/model requests fail. */
  evaluationFailures: EvaluationFailureAudit[]
  platformsMeta: SearchMeta | null
}
