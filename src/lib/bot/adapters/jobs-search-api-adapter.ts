/**
 * RapidAPI Jobs Search API — multi-board job search (LinkedIn, Glassdoor, ZipRecruiter, etc.).
 *
 * https://rapidapi.com/rphrp1985/api/jobs-search-api — host jobs-search-api.p.rapidapi.com
 * POST /getjobs_excel returns an **Excel workbook** (.xlsx), not JSON (name is accurate).
 *
 * Env:
 *   JOBS_SEARCH_API_KEY — RapidAPI key for jobs-search-api
 *   JOBS_SEARCH_COUNTRY_INDEED — country hint required by API payload (default USA); set e.g. Portugal for EU runs
 *   JOBS_SEARCH_SITE_NAMES — comma-separated boards (default: linkedin,glassdoor,zip_recruiter,naukri,bayt — no Indeed)
 *   JOBS_SEARCH_DISTANCE — search radius (default 500)
 *   JOBS_SEARCH_HOURS_OLD — max job age in hours (default 72)
 *   JOBS_SEARCH_JOB_TYPE — default fulltime
 *   JOBS_SEARCH_LINKEDIN_DESC=1 — set linkedin_fetch_description true
 */

import * as XLSX from 'xlsx'

import type { SearchJobResult, SearchProviderPassMeta } from '../types'
import { extractRapidApiJobRows, normalizeRapidApiJobFromUnknownRow } from './rapidapi-linkedin-job-json'

const BASE = 'https://jobs-search-api.p.rapidapi.com'
const HOST = 'jobs-search-api.p.rapidapi.com'
const REQUEST_TIMEOUT_MS = 30_000

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function parseSiteNames(): string[] {
  const e = process.env.JOBS_SEARCH_SITE_NAMES?.trim()
  if (e) {
    return e.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  }
  return ['linkedin', 'glassdoor', 'zip_recruiter', 'naukri', 'bayt']
}

/** .xlsx is a ZIP file; magic bytes "PK". */
function isXlsxBuffer(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b
}

function cellStr(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') {
    const t = v.trim()
    return t || undefined
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return undefined
}

/** Map heterogeneous Excel column headers onto fields `normalizeRapidApiJobRow` understands. */
function augmentRowFromExcelHeaders(row: Record<string, unknown>): Record<string, unknown> {
  const lc = new Map<string, unknown>()
  for (const [k, v] of Object.entries(row)) {
    const nk = k.trim().toLowerCase().replace(/\s+/g, ' ')
    lc.set(nk, v)
  }
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const s = cellStr(lc.get(key))
      if (s) return s
    }
    return undefined
  }

  return {
    ...row,
    title: get('title', 'job title', 'job_title', 'position', 'role', 'job name') ?? row.title,
    company:
      get('company', 'company name', 'company_name', 'employer', 'hiring organization', 'organization') ??
      row.company,
    url: get('url', 'job url', 'job_url', 'link', 'apply url', 'apply_url', 'job link') ?? row.url,
    location: get('location', 'job location', 'job_location', 'city', 'formatted location') ?? row.location,
    description:
      get('description', 'job description', 'job_description', 'snippet', 'summary') ?? row.description,
    site: get('site', 'site name', 'site_name', 'source', 'board', 'job board') ?? row.site,
    site_name: get('site name', 'site_name', 'source') ?? row.site_name,
  }
}

function jobRowsFromXlsx(buffer: ArrayBuffer): { rows: Record<string, unknown>[]; error?: string } {
  try {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
    const name = wb.SheetNames[0]
    if (!name) return { rows: [], error: 'Jobs Search API: empty Excel workbook' }
    const sheet = wb.Sheets[name]
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
    const rows = raw.map((r) => augmentRowFromExcelHeaders(r))
    return { rows }
  } catch (e) {
    return {
      rows: [],
      error: `Jobs Search API: failed to parse Excel (${e instanceof Error ? e.message : String(e)})`,
    }
  }
}

function inferBoardSource(row: Record<string, unknown>): string {
  const s = (
    str(row.site) ??
    str(row.site_name) ??
    str(row.source) ??
    str(row.job_board) ??
    ''
  ).toLowerCase()
  if (s.includes('linkedin')) return 'linkedin'
  if (s.includes('indeed')) return 'indeed'
  if (s.includes('glassdoor')) return 'glassdoor'
  if (s.includes('zip')) return 'zip_recruiter'
  if (s.includes('naukri') || s.includes('bayt')) return 'jobs_search_api'
  return 'jobs_search_api'
}

export async function searchJobsSearchApiExcel(
  params: {
    searchTerm: string
    location: string
    resultsWanted: number
    isRemote: boolean
    /**
     * Optional free-text hint appended to the search term to bias toward a
     * seniority bucket (e.g. "senior", "intern"). Derived from the user's
     * BotConfig.experienceLevel in the caller — no hardcoded value here.
     */
    experienceHint?: string | null
    /** Location-aware country hint for the provider payload. */
    countryIndeed?: string | null
    /** Whether to ask LinkedIn rows for full descriptions when this board is selected. */
    linkedinFetchDescription?: boolean
    /** Region-aware board selection from the unified search planner. */
    siteNames?: string[]
    /** Pass provenance persisted on every normalized row. */
    providerPass?: SearchProviderPassMeta
  },
  apiKey: string
): Promise<{ jobs: SearchJobResult[]; error?: string }> {
  const trimmedTerm = params.searchTerm.trim()
  if (!trimmedTerm) return { jobs: [], error: 'Jobs Search API: empty search_term' }
  const hint = params.experienceHint?.trim()
  const search_term =
    hint && !new RegExp(`\\b${hint}\\b`, 'i').test(trimmedTerm)
      ? `${hint} ${trimmedTerm}`
      : trimmedTerm

  const location = params.location.trim() || 'Remote'
  const results_wanted = Math.min(Math.max(params.resultsWanted, 1), 100)
  const distance = Number(process.env.JOBS_SEARCH_DISTANCE) || 500
  const hours_old = Number(process.env.JOBS_SEARCH_HOURS_OLD) || 72
  const job_type = process.env.JOBS_SEARCH_JOB_TYPE?.trim() || 'fulltime'
  const site_name = params.siteNames?.length ? params.siteNames : parseSiteNames()
  const country_indeed =
    params.countryIndeed?.trim() ||
    process.env.JOBS_SEARCH_COUNTRY_INDEED?.trim() ||
    'USA'
  const linkedin_fetch_description =
    params.linkedinFetchDescription ?? process.env.JOBS_SEARCH_LINKEDIN_DESC === '1'

  try {
    const res = await fetch(`${BASE}/getjobs_excel`, {
      method: 'POST',
      headers: {
        'x-rapidapi-host': HOST,
        'x-rapidapi-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        search_term,
        location: location.toLowerCase(),
        country_indeed,
        results_wanted,
        site_name,
        distance,
        job_type,
        is_remote: params.isRemote,
        linkedin_fetch_description,
        hours_old,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    const buf = await res.arrayBuffer().catch(() => null)
    if (!buf) return { jobs: [], error: 'Jobs Search API: empty response body' }

    const bytes = new Uint8Array(buf)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

    if (!res.ok) {
      let msg = text.slice(0, 280)
      try {
        const j = JSON.parse(text) as { message?: string }
        if (j.message) msg = j.message
      } catch {
        /* keep slice */
      }
      return { jobs: [], error: `Jobs Search API HTTP ${res.status}: ${msg}` }
    }

    let rows: Record<string, unknown>[]

    if (isXlsxBuffer(bytes)) {
      const parsed = jobRowsFromXlsx(buf)
      if (parsed.error) return { jobs: [], error: parsed.error }
      rows = parsed.rows
    } else {
      const trimmed = text.trim()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        const hint = trimmed.slice(0, 80).replace(/\s+/g, ' ')
        return {
          jobs: [],
          error: `Jobs Search API: expected JSON or .xlsx; got non-JSON text (${hint}${trimmed.length > 80 ? '…' : ''})`,
        }
      }
      let body: unknown
      try {
        body = JSON.parse(trimmed)
      } catch {
        return { jobs: [], error: 'Jobs Search API: invalid JSON response' }
      }
      rows = extractRapidApiJobRows(body)
    }
    const jobs: SearchJobResult[] = []
    for (const row of rows) {
      const board = inferBoardSource(row)
      const j = normalizeRapidApiJobFromUnknownRow(row as Record<string, unknown>, 'jobs_search_api')
      if (j) {
        j.jobBoard = board
        if (params.providerPass) j.providerPass = params.providerPass
        jobs.push(j)
      }
    }

    return { jobs }
  } catch (err) {
    return {
      jobs: [],
      error: `Jobs Search API: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
