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
 * RapidAPI calls stay serial by default to avoid provider rate limits.
 * Raise only after production telemetry shows the provider handles it safely.
 */
export const BOT_SEARCH_RAPIDAPI_CONCURRENCY = 1
