/**
 * Optional comma-separated allowlist — run only selected RapidAPI backends.
 *
 * Env: `BOT_SEARCH_SOURCES` — e.g. `jsearch` or `jobs_search_api` or `jsearch,jobs_search_api`.
 * Tokens: `jsearch`, `jobs_search_api`
 * Omit or leave empty → every backend that has keys (JSearch + Jobs Search API).
 */

import { jobsSearchApiRapidApiKey } from './rapidapi-jobs-search-keys'

export type BotSearchSourceToken = 'jsearch' | 'jobs_search_api'

const VALID = new Set<string>(['jsearch', 'jobs_search_api'])

/** `null` = no filter (all backends that have keys). */
export function botSearchSourcesAllowlist(): Set<BotSearchSourceToken> | null {
  const raw = (process.env.BOT_SEARCH_SOURCES ?? '').trim()
  if (!raw) return null
  const parts = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => VALID.has(s)) as BotSearchSourceToken[]
  if (!parts.length) return null
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
  const allow = botSearchSourcesAllowlist()
  const ok = (t: BotSearchSourceToken, fn: () => boolean) =>
    botSearchSourceAllowed(allow, t) && fn()

  if (
    ok('jsearch', () => !!(process.env.JSEARCH_API_KEY ?? '').trim()) ||
    ok('jobs_search_api', () => jobsSearchApiRapidApiKey().length > 0)
  ) {
    return true
  }
  return false
}

/** Which adapters will actually run (for CLI / bot preview text). */
export function effectiveSearchBackendLabels(): string[] {
  const allow = botSearchSourcesAllowlist()
  const lines: string[] = []
  if (botSearchSourceAllowed(allow, 'jsearch') && (process.env.JSEARCH_API_KEY ?? '').trim()) {
    lines.push('JSearch')
  }
  if (botSearchSourceAllowed(allow, 'jobs_search_api') && jobsSearchApiRapidApiKey().length > 0) {
    lines.push('Jobs Search API (getjobs_excel)')
  }
  return lines
}
