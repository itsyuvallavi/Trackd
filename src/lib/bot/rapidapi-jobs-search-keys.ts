/**
 * RapidAPI Jobs Search API (multi-board POST getjobs_excel).
 *
 * Key resolution: JOBS_SEARCH_API_KEY, else JSEARCH (same RapidAPI account is fine).
 */

const trim = (v: string | undefined) => (v ?? '').trim()

export function jobsSearchApiRapidApiKey(): string {
  return (
    trim(process.env.JOBS_SEARCH_API_KEY) ||
    trim(process.env.JSEARCH_API_KEY) ||
    ''
  )
}
