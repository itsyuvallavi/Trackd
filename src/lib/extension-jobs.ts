import { createHash } from 'crypto'
import { JobSource } from '@prisma/client'

export type SanitizedExtensionJobPayload = {
  company: string
  title: string
  location: string | null
  url: string | null
  salary: string | null
  source: JobSource
  sourceLabel: string | null
}

export function hashExtensionKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function isValidExtensionKeyFormat(key: unknown): key is string {
  return typeof key === 'string' && /^tk_[A-Za-z0-9_-]{32}$/.test(key)
}

export function mapExtensionSourceToJobSource(source: unknown): JobSource {
  const sourceMap: Record<string, JobSource> = {
    LinkedIn: JobSource.LINKEDIN,
    Indeed: JobSource.INDEED,
    Greenhouse: JobSource.COMPANY_SITE,
    Lever: JobSource.COMPANY_SITE,
    Workable: JobSource.WORKABLE,
    'EU Remote Jobs': JobSource.EU_REMOTE_JOBS,
    ZipRecruiter: JobSource.ZIPRECRUITER,
    'Landing.jobs': JobSource.LANDING_JOBS,
    Extension: JobSource.OTHER,
  }

  return typeof source === 'string' ? sourceMap[source] ?? JobSource.OTHER : JobSource.OTHER
}

export function sanitizeExtensionJobPayload(
  jobData: Record<string, unknown>,
):
  | { ok: true; data: SanitizedExtensionJobPayload }
  | { ok: false; status: 400; error: string } {
  if (!jobData.company || typeof jobData.company !== 'string') {
    return { ok: false, status: 400, error: 'Company is required' }
  }

  if (!jobData.title || typeof jobData.title !== 'string') {
    return { ok: false, status: 400, error: 'Title is required' }
  }

  const company = jobData.company.trim().slice(0, 200)
  const title = jobData.title.trim().slice(0, 300)
  const location = jobData.location ? String(jobData.location).trim().slice(0, 200) : null
  const url = jobData.url ? String(jobData.url).trim().slice(0, 2048) : null
  const salary = jobData.salary ? String(jobData.salary).trim().slice(0, 100) : null

  if (company.length === 0 || title.length === 0) {
    return { ok: false, status: 400, error: 'Company and title cannot be empty' }
  }

  if (url) {
    try {
      const urlObj = new URL(url)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { ok: false, status: 400, error: 'Invalid URL protocol' }
      }
    } catch {
      return { ok: false, status: 400, error: 'Invalid URL format' }
    }
  }

  return {
    ok: true,
    data: {
      company,
      title,
      location,
      url,
      salary,
      source: mapExtensionSourceToJobSource(jobData.source),
      sourceLabel: typeof jobData.source === 'string' ? jobData.source : null,
    },
  }
}
