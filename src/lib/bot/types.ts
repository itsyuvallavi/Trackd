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
}

export interface SearchMeta {
  platforms_succeeded: string[]
  platforms_failed: Record<string, string>
  fallback_used: boolean
  total_raw: number
  total_deduped: number
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
  platforms?: string[]
  experience_level?: string | null
  proxy?: string | null
  serp_api_key?: string | null
}

export interface JobEvaluation {
  score: number           // 0-100
  reasoning: string       // Short explanation
  shouldApply: boolean    // true if score >= threshold
  flags: string[]         // e.g. ["salary_low", "overqualified", "good_match"]
}

export interface OrchestratorResult {
  jobsFound: number
  jobsNew: number
  jobsEvaluated: number
  jobsApproved: number
  errors: Record<string, string>
  platformsMeta: SearchMeta | null
}
