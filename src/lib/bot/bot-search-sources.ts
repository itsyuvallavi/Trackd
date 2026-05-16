/**
 * Optional comma-separated allowlist for job-search backends.
 *
 * Env: `BOT_SEARCH_SOURCES`
 * Tokens: `jobs_search_api`
 * Omit or leave empty → Jobs Search API runs when `JOBS_SEARCH_API_KEY` is set.
 */

import { jobsSearchApiRapidApiKey } from './rapidapi-jobs-search-keys'

export type BotSearchSourceToken = 'jobs_search_api'

const VALID = new Set<string>(['jobs_search_api'])

/** `null` = no filter (all backends that have keys). */
export function botSearchSourcesAllowlist(): Set<BotSearchSourceToken> | null {
  const raw = (process.env.BOT_SEARCH_SOURCES ?? '').trim()
  if (!raw) return null
  const parts = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => VALID.has(s)) as BotSearchSourceToken[]
  if (!parts.length) return new Set()
  return new Set(parts)
}

export function botSearchSourceAllowed(
  allowlist: Set<BotSearchSourceToken> | null,
  token: BotSearchSourceToken
): boolean {
  if (!allowlist) return true
  return allowlist.has(token)
}

/** Used by cron, triggerBotSearch, orchestrator — enough backends for the active allowlist + keys. */
export function botSearchHasQueryableBackend(): boolean {
  const backends = effectiveSearchBackends()

  return backends.jobsSearchApi
}

/** Backend booleans after applying both env keys and `BOT_SEARCH_SOURCES`. */
export function effectiveSearchBackends(): { jobsSearchApi: boolean } {
  const allow = botSearchSourcesAllowlist()

  return {
    jobsSearchApi:
      botSearchSourceAllowed(allow, 'jobs_search_api') && jobsSearchApiRapidApiKey().length > 0,
  }
}

/** Which adapters will actually run (for CLI / bot preview text). */
export function effectiveSearchBackendLabels(): string[] {
  const backends = effectiveSearchBackends()
  const lines: string[] = []
  if (backends.jobsSearchApi) {
    lines.push('Jobs Search API (getjobs_excel)')
  }
  return lines
}
