/**
 * RapidAPI Jobs Search API (multi-board POST getjobs_excel).
 *
 * Key resolution: JOBS_SEARCH_API_KEY.
 */

const trim = (v: string | undefined) => (v ?? '').trim()

export function jobsSearchApiRapidApiKey(): string {
  return trim(process.env.JOBS_SEARCH_API_KEY)
}
