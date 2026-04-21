/**
 * Shared JSON extraction + row normalization for RapidAPI LinkedIn-style job payloads.
 */

import type { SearchJobResult } from '../types'

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function nonEmptyObjectArray(x: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(x) || x.length === 0) return null
  return x as Record<string, unknown>[]
}

function arraysFromDataObject(inner: Record<string, unknown>): Record<string, unknown>[] {
  return (
    nonEmptyObjectArray(inner.jobs) ??
    nonEmptyObjectArray(inner.items) ??
    nonEmptyObjectArray(inner.data) ??
    nonEmptyObjectArray(inner.elements) ??
    nonEmptyObjectArray(inner.searchResults) ??
    nonEmptyObjectArray(inner.jobResults) ??
    nonEmptyObjectArray(inner.jobListings) ??
    nonEmptyObjectArray(inner.listings) ??
    nonEmptyObjectArray(inner.results) ??
    []
  )
}

/** Best-effort list of job objects from heterogeneous RapidAPI responses. */
export function extractRapidApiJobRows(body: unknown): Record<string, unknown>[] {
  if (body == null) return []
  if (Array.isArray(body)) {
    return body.length > 0 ? (body as Record<string, unknown>[]) : []
  }
  if (typeof body !== 'object') return []
  const o = body as Record<string, unknown>

  if (o.success === false) return []

  const a =
    nonEmptyObjectArray(o.data) ??
    nonEmptyObjectArray(o.jobs) ??
    nonEmptyObjectArray(o.results) ??
    nonEmptyObjectArray(o.items) ??
    nonEmptyObjectArray(o.elements) ??
    nonEmptyObjectArray(o.searchResults) ??
    nonEmptyObjectArray(o.jobResults) ??
    nonEmptyObjectArray(o.listings) ??
    nonEmptyObjectArray(o.included)

  if (a) return a

  if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
    const nested = arraysFromDataObject(o.data as Record<string, unknown>)
    if (nested.length > 0) return nested
  }

  if (o.result && typeof o.result === 'object' && !Array.isArray(o.result)) {
    const nested = arraysFromDataObject(o.result as Record<string, unknown>)
    if (nested.length > 0) return nested
  }

  return []
}

function orgName(raw: Record<string, unknown>, key: string): string | null {
  const v = raw[key]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return str((v as Record<string, unknown>).name)
}

export function normalizeRapidApiJobRow(
  raw: Record<string, unknown>,
  source: string
): SearchJobResult | null {
  const title =
    str(raw.title) ??
    str(raw.jobTitle) ??
    str(raw.job_title) ??
    str(raw.position) ??
    str(raw.positionTitle) ??
    str(raw.name)

  const companyRaw = raw.company
  const company =
    (typeof companyRaw === 'object' && companyRaw !== null
      ? str((companyRaw as Record<string, unknown>).name) ??
        str((companyRaw as Record<string, unknown>).title)
      : str(companyRaw)) ??
    str(raw.company_name) ??
    str(raw.companyName) ??
    orgName(raw, 'hiringOrganization') ??
    orgName(raw, 'organization') ??
    orgName(raw, 'employer')

  if (!title || !company) return null

  const url =
    str(raw.url) ??
    str(raw.link) ??
    str(raw.jobUrl) ??
    str(raw.job_url) ??
    str(raw.applyUrl) ??
    str(raw.applicationUrl) ??
    str(raw.job_link) ??
    str(raw.jobLink)

  const location =
    str(raw.location) ??
    str(raw.formattedLocation) ??
    str(raw.locationName) ??
    null

  const description =
    str(raw.description) ??
    str(raw.jobDescription) ??
    str(raw.desc) ??
    null

  const posted = str(raw.postedDate) ?? str(raw.listedAt) ?? str(raw.posted_at) ?? null

  const locLower = (location ?? '').toLowerCase()
  const descLower = (description ?? '').toLowerCase()
  const mentionsRemote =
    locLower.includes('remote') ||
    descLower.includes('remote') ||
    title.toLowerCase().includes('remote')
  const isRemote = mentionsRemote ? true : null

  return {
    title,
    company,
    location,
    url,
    description,
    salary_min: typeof raw.salaryMin === 'number' ? raw.salaryMin : null,
    salary_max: typeof raw.salaryMax === 'number' ? raw.salaryMax : null,
    salary_currency: str(raw.salaryCurrency) ?? null,
    source,
    posted_date: posted,
    job_type: str(raw.employmentType) ?? str(raw.jobType) ?? null,
    is_remote: isRemote,
    company_logo: str(raw.companyLogo) ?? str(raw.company_logo) ?? str(raw.companyLogoUrl) ?? null,
  }
}

export function normalizeRapidApiJobFromUnknownRow(
  row: Record<string, unknown>,
  source: string
): SearchJobResult | null {
  const direct = normalizeRapidApiJobRow(row, source)
  if (direct) return direct
  for (const key of ['job', 'jobPosting', 'entity', 'item', 'listing', 'card'] as const) {
    const inner = row[key]
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const j = normalizeRapidApiJobRow(inner as Record<string, unknown>, source)
      if (j) return j
    }
  }
  return null
}
