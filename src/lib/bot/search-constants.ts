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

/**
 * Jobs Search API's RapidAPI plan rate-limits by second. Keep provider calls
 * serial and lightly spaced; AI scoring is where we use bounded parallelism.
 */
export const BOT_SEARCH_RAPIDAPI_CONCURRENCY = 1
export const BOT_SEARCH_RAPIDAPI_MIN_INTERVAL_MS = 1_100
export const BOT_SEARCH_RAPIDAPI_MAX_ATTEMPTS = 3
export const BOT_SEARCH_RAPIDAPI_RETRY_BACKOFF_MS = 5_000

/**
 * AI scoring is the slowest part of a run. Keep it bounded so the production
 * "Run now" action makes steady progress without overloading the model provider.
 */
export const BOT_SEARCH_AI_EVAL_CONCURRENCY = 3
