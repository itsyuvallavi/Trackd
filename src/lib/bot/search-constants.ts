/** Cap on listings returned after dedup (orchestrator passes this to `runSearch`). */
export const BOT_SEARCH_RESULTS_WANTED = 45

/**
 * First N non-empty keywords are combined with OR for JSearch queries.
 * Higher N = broader role coverage per run (longer query string).
 */
export const BOT_SEARCH_KEYWORD_OR_MAX = 5

/**
 * Up to N location tags each get their own search pass per API (wider geographic net).
 */
export const BOT_SEARCH_LOCATION_PASSES_MAX = 5

export type JSearchDatePosted = 'all' | 'today' | '3days' | 'week' | 'month'

const JSEARCH_DATE_ALLOWED: readonly JSearchDatePosted[] = [
  'all',
  'today',
  '3days',
  'week',
  'month',
] as const

function resolveJSearchDatePosted(): JSearchDatePosted {
  const raw = (process.env.JSEARCH_DATE_POSTED ?? '').trim().toLowerCase()
  if (raw && (JSEARCH_DATE_ALLOWED as readonly string[]).includes(raw)) {
    return raw as JSearchDatePosted
  }
  /** Default `week` — `month` surfaces many stale / effectively expired listings. */
  return 'week'
}

/**
 * JSearch `date_posted` filter. Override with env `JSEARCH_DATE_POSTED`
 * (`all` | `today` | `3days` | `week` | `month`).
 * @see https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 */
export const JSEARCH_DATE_POSTED: JSearchDatePosted = resolveJSearchDatePosted()

/** UI copy — keep aligned with `JSEARCH_DATE_POSTED`. */
export function describeJSearchDateWindow(): string {
  const labels: Record<JSearchDatePosted, string> = {
    all: 'any time (no date filter)',
    today: 'today',
    '3days': 'the last few days',
    week: 'the past week',
    month: 'the past month',
  }
  return labels[JSEARCH_DATE_POSTED]
}
