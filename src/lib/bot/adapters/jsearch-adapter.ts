/**
 * JSearch adapter — searches LinkedIn, Indeed, Glassdoor, ZipRecruiter via RapidAPI.
 *
 * API docs: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 * Free tier: 200 requests/month. Paid: from $10/month for more volume.
 *
 * Env vars needed:
 *   JSEARCH_API_KEY — your RapidAPI key (subscribe to JSearch on RapidAPI)
 */

import type { SearchJobResult } from '../types'

const JSEARCH_BASE = 'https://jsearch.p.rapidapi.com'

export interface JSearchParams {
  query: string
  location?: string
  remoteOnly?: boolean
  employmentType?: string    // FULLTIME | PARTTIME | CONTRACTOR | INTERN
  datePosted?: string        // all | today | 3days | week | month
  numPages?: number          // 1–20, each page has 10 results
  excludeJobPublishers?: string[]
}

interface JSearchJob {
  job_id: string
  job_title: string
  employer_name: string
  job_city?: string
  job_state?: string
  job_country?: string
  job_apply_link?: string
  job_description?: string
  job_is_remote?: boolean
  job_posted_at_datetime_utc?: string
  job_employment_type?: string
  job_min_salary?: number
  job_max_salary?: number
  job_salary_currency?: string
  employer_logo?: string
}

interface JSearchResponse {
  status: string
  data?: JSearchJob[]
  message?: string
}

function buildLocation(job: JSearchJob): string | null {
  const parts = [job.job_city, job.job_state, job.job_country].filter(Boolean)
  return parts.join(', ') || null
}

function toIsoDate(raw?: string): string | null {
  if (!raw) return null
  try {
    return new Date(raw).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

export async function searchJSearch(
  params: JSearchParams,
  apiKey: string
): Promise<{ jobs: SearchJobResult[]; error?: string }> {
  const query = params.remoteOnly
    ? `${params.query} remote`
    : params.location
      ? `${params.query} in ${params.location}`
      : params.query

  const numPages = Math.min(params.numPages ?? 2, 5)
  const allJobs: SearchJobResult[] = []

  for (let page = 1; page <= numPages; page++) {
    const url = new URL(`${JSEARCH_BASE}/search`)
    url.searchParams.set('query', query)
    url.searchParams.set('page', String(page))
    url.searchParams.set('num_pages', '1')
    url.searchParams.set('date_posted', params.datePosted ?? 'week')
    if (params.remoteOnly) url.searchParams.set('remote_jobs_only', 'true')
    if (params.employmentType) url.searchParams.set('employment_types', params.employmentType)
    if (params.excludeJobPublishers?.length) {
      url.searchParams.set('exclude_job_publishers', params.excludeJobPublishers.join(','))
    }

    let res: Response
    try {
      res = await fetch(url.toString(), {
        headers: {
          'x-rapidapi-host': 'jsearch.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
        signal: AbortSignal.timeout(20_000),
      })
    } catch (err) {
      return { jobs: allJobs, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 429) return { jobs: allJobs, error: 'JSearch rate limit hit' }
      if (res.status === 403) return { jobs: allJobs, error: 'JSearch: invalid API key' }
      return { jobs: allJobs, error: `JSearch HTTP ${res.status}: ${text.slice(0, 100)}` }
    }

    const body = (await res.json()) as JSearchResponse
    if (body.status !== 'OK' || !body.data?.length) break

    for (const job of body.data) {
      allJobs.push({
        title: job.job_title,
        company: job.employer_name,
        location: buildLocation(job),
        url: job.job_apply_link ?? null,
        description: job.job_description ?? null,
        salary_min: job.job_min_salary ?? null,
        salary_max: job.job_max_salary ?? null,
        salary_currency: job.job_salary_currency ?? null,
        source: 'jsearch',
        posted_date: toIsoDate(job.job_posted_at_datetime_utc),
        job_type: job.job_employment_type ?? null,
        is_remote: job.job_is_remote ?? null,
        company_logo: job.employer_logo ?? null,
      })
    }
  }

  return { jobs: allJobs }
}
