/** Cap on listings returned after dedup (orchestrator passes this to `runSearch`). */
export const BOT_SEARCH_RESULTS_WANTED = 45

/**
 * First N non-empty keywords are sent to the search backend.
 * Higher N = broader role coverage per run.
 */
export const BOT_SEARCH_KEYWORD_OR_MAX = 5

/**
 * Up to N location tags each get their own search pass per API (wider geographic net).
 */
export const BOT_SEARCH_LOCATION_PASSES_MAX = 5
