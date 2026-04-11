/**
 * SerpAPI adapter — searches Google Jobs.
 *
 * API docs: https://serpapi.com/google-jobs-api
 * Free tier: 100 searches/month. Paid: from $50/month.
 *
 * Env vars needed:
 *   SERP_API_KEY — your SerpAPI key (https://serpapi.com)
 */

import type { SearchJobResult } from '../types'

const SERPAPI_BASE = 'https://serpapi.com/search'

export interface SerpApiParams {
  query: string
  location?: string
  remoteOnly?: boolean
  resultsWanted?: number
}

interface SerpApiJob {
  title: string
  company_name: string
  location?: string
  via?: string
  description?: string
  detected_extensions?: {
    posted_at?: string
    schedule_type?: string
    salary?: string
  }
  job_highlights?: Array<{ title: string; items: string[] }>
  related_links?: Array<{ link: string; text: string }>
  apply_options?: Array<{ link: string; title: string }>
}

interface SerpApiResponse {
  error?: string
  jobs_results?: SerpApiJob[]
}

function extractSalary(job: SerpApiJob): { min: number | null; max: number | null } {
  const raw = job.detected_extensions?.salary ?? ''
  if (!raw) return { min: null, max: null }

  const cleanNum = (s: string) => {
    const m = s.replace(/,/g, '').match(/[\d.]+[kK]?/)
    if (!m) return null
    const val = parseFloat(m[0].replace(/[kK]$/, ''))
    return m[0].toLowerCase().endsWith('k') ? val * 1000 : val
  }

  const parts = raw.split(/[–—-]/)
  const nums = parts.map(cleanNum).filter((n): n is number => n !== null)
  if (nums.length >= 2) return { min: Math.min(...nums), max: Math.max(...nums) }
  if (nums.length === 1) return { min: nums[0], max: null }
  return { min: null, max: null }
}

function extractUrl(job: SerpApiJob): string | null {
  return (
    job.apply_options?.[0]?.link ??
    job.related_links?.[0]?.link ??
    null
  )
}

function extractDate(postedAt?: string): string | null {
  if (!postedAt) return null
  const lower = postedAt.toLowerCase()
  const now = new Date()

  if (lower.includes('hour') || lower === 'today' || lower.includes('just')) {
    return now.toISOString().slice(0, 10)
  }

  const dayMatch = lower.match(/(\d+)\s*day/)
  if (dayMatch) {
    const d = new Date(now)
    d.setDate(d.getDate() - parseInt(dayMatch[1]))
    return d.toISOString().slice(0, 10)
  }

  const weekMatch = lower.match(/(\d+)\s*week/)
  if (weekMatch) {
    const d = new Date(now)
    d.setDate(d.getDate() - parseInt(weekMatch[1]) * 7)
    return d.toISOString().slice(0, 10)
  }

  return null
}

export async function searchSerpApi(
  params: SerpApiParams,
  apiKey: string
): Promise<{ jobs: SearchJobResult[]; error?: string }> {
  const query = params.remoteOnly
    ? `${params.query} remote`
    : params.location
      ? `${params.query} ${params.location}`
      : params.query

  const allJobs: SearchJobResult[] = []
  const wantedPages = Math.ceil((params.resultsWanted ?? 10) / 10)

  for (let start = 0; start < wantedPages * 10; start += 10) {
    const url = new URL(SERPAPI_BASE)
    url.searchParams.set('engine', 'google_jobs')
    url.searchParams.set('q', query)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('hl', 'en')
    if (start > 0) url.searchParams.set('start', String(start))

    let res: Response
    try {
      res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) })
    } catch (err) {
      return { jobs: allJobs, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { jobs: allJobs, error: `SerpAPI HTTP ${res.status}: ${text.slice(0, 100)}` }
    }

    const body = (await res.json()) as SerpApiResponse
    if (body.error) return { jobs: allJobs, error: `SerpAPI error: ${body.error}` }

    const raw = body.jobs_results ?? []
    if (raw.length === 0) break

    for (const job of raw) {
      const salary = extractSalary(job)
      allJobs.push({
        title: job.title,
        company: job.company_name,
        location: job.location ?? null,
        url: extractUrl(job),
        description: job.description ?? null,
        salary_min: salary.min,
        salary_max: salary.max,
        salary_currency: 'USD',
        source: 'serpapi_google',
        posted_date: extractDate(job.detected_extensions?.posted_at),
        job_type: job.detected_extensions?.schedule_type ?? null,
        is_remote: (job.location ?? '').toLowerCase().includes('remote') ||
                   (job.description ?? '').toLowerCase().startsWith('remote'),
        company_logo: null,
      })
    }

    if (raw.length < 10) break
  }

  return { jobs: allJobs }
}
