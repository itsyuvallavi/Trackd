/**
 * LinkedIn Jobs Search adapter via RapidAPI.
 *
 * Uses the "LinkedIn Jobs Search" API on RapidAPI.
 * Sign up at https://rapidapi.com and subscribe to a LinkedIn Jobs endpoint.
 * Add your RapidAPI key as LINKEDIN_API_KEY in Vercel env vars.
 *
 * Env vars:
 *   LINKEDIN_API_KEY — RapidAPI key subscribed to a LinkedIn Jobs Search API
 */

import type { SearchJobResult } from '../types'

const RAPIDAPI_HOST = 'linkedin-jobs-search.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}/`

interface LinkedInJob {
  position?: string
  company?: string
  location?: string
  'job-link'?: string
  agoTime?: string
  salary?: string
  jobProviderJobId?: string
  // alternate field names from different LinkedIn API providers
  title?: string
  companyName?: string
  jobUrl?: string
  applyUrl?: string
  description?: string
  postedAt?: string
  employmentType?: string
}

export interface LinkedInSearchParams {
  query: string
  location?: string
  dateSincePosted?: string  // 'past-24h' | 'past-week' | 'past-month' | 'any-time'
  jobType?: string           // 'full-time' | 'part-time' | 'contract' | 'internship'
  remoteOnly?: boolean
  resultsWanted?: number
}

function normalizeJob(raw: LinkedInJob, index: number): SearchJobResult | null {
  const title = raw.position ?? raw.title
  const company = raw.company ?? raw.companyName
  if (!title || !company) return null

  const url = raw['job-link'] ?? raw.jobUrl ?? raw.applyUrl ?? null

  return {
    title,
    company,
    location: raw.location ?? null,
    url,
    description: raw.description ?? null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    source: 'linkedin',
    posted_date: null,
    job_type: raw.employmentType ?? null,
    is_remote: raw.location?.toLowerCase().includes('remote') ?? null,
    company_logo: null,
  }
}

export async function searchLinkedIn(
  params: LinkedInSearchParams,
  apiKey: string
): Promise<{ jobs: SearchJobResult[]; error?: string }> {
  const query = params.remoteOnly
    ? `${params.query} remote`
    : params.location
      ? `${params.query} ${params.location}`
      : params.query

  try {
    const url = new URL(BASE_URL)
    url.searchParams.set('keywords', query)
    if (params.location && !params.remoteOnly) {
      url.searchParams.set('locationId', '')
      url.searchParams.set('location', params.location)
    }
    url.searchParams.set('dateSincePosted', params.dateSincePosted ?? 'past-week')
    if (params.jobType) url.searchParams.set('jobType', params.jobType)
    if (params.remoteOnly) url.searchParams.set('remoteFilter', 'remote')

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 429) return { jobs: [], error: 'LinkedIn API rate limit hit' }
      if (res.status === 403) return { jobs: [], error: 'LinkedIn API: invalid key' }
      return { jobs: [], error: `LinkedIn API HTTP ${res.status}: ${text.slice(0, 100)}` }
    }

    const body = await res.json() as LinkedInJob[] | { data?: LinkedInJob[] }
    const rawJobs: LinkedInJob[] = Array.isArray(body) ? body : (body.data ?? [])

    const jobs = rawJobs
      .map((j, i) => normalizeJob(j, i))
      .filter((j): j is SearchJobResult => j !== null)
      .slice(0, params.resultsWanted ?? 20)

    return { jobs }
  } catch (err) {
    return {
      jobs: [],
      error: `LinkedIn network error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
