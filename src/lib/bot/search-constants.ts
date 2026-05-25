/** Cap on listings returned after dedup (orchestrator passes this to `runSearch`). */
export const BOT_SEARCH_RESULTS_WANTED = 45

/**
 * First N non-empty keywords are sent to the search backend as separate passes.
 * Higher N = broader role coverage per run.
 */
export const BOT_SEARCH_KEYWORD_OR_MAX = 5

/**
 * Up to N location tags each get their own search pass per API (wider geographic net).
 */
export const BOT_SEARCH_LOCATION_PASSES_MAX = 5

/**
 * Hard cap on provider calls per bot search run after keyword x location fanout.
 * Keeps broad profiles reliable without letting maxed settings create 25+ calls.
 */
export const BOT_SEARCH_PROVIDER_PASSES_MAX = 10

/**
 * Minimum rows requested from each provider pass before local dedupe/final cap.
 * Sparse provider queries can bury useful listings below the top 5, especially
 * when duplicate-heavy role aliases share the same first few rows.
 */
export const BOT_SEARCH_PROVIDER_RESULTS_MIN = 10

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Jobs Search API calls are slow. We keep request starts spaced to respect
 * per-second rate limits, but allow HTTP responses to overlap so broad runs do
 * not spend 1-2 minutes waiting on provider I/O.
 */
export const BOT_SEARCH_RAPIDAPI_CONCURRENCY = positiveIntEnv(
  'BOT_SEARCH_RAPIDAPI_CONCURRENCY',
  2
)
export const BOT_SEARCH_RAPIDAPI_MIN_INTERVAL_MS = 1_100
export const BOT_SEARCH_RAPIDAPI_MAX_ATTEMPTS = 3
export const BOT_SEARCH_RAPIDAPI_RETRY_BACKOFF_MS = 5_000

/**
 * AI scoring is the slowest part of a run. Keep it bounded so the production
 * "Run now" action makes steady progress without overloading the model provider.
 */
export const BOT_SEARCH_AI_EVAL_CONCURRENCY = positiveIntEnv(
  'BOT_SEARCH_AI_EVAL_CONCURRENCY',
  6
)
