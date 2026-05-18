/**
 * Persisted audit rows for bot search runs: listing snapshots, scoring context, outcomes.
 * @see docs/BOT_RUN_AUDIT.md
 */

import type { Prisma } from '@prisma/client'
import type { SearchJobResult } from './types'
import { prisma } from '@/lib/prisma'

const JOB_DESCRIPTION_AUDIT_MAX = 8000

export const BOT_LISTING_STAGE = {
  DEDUP_URL: 'dedup_url',
  DEDUP_TITLE: 'dedup_title',
  /** User deleted this listing earlier — do not re-import */
  DEDUP_DISMISSED: 'dedup_dismissed',
  DEDUP_BATCH: 'dedup_batch',
  HARD_FILTER: 'hard_filter',
  BELOW_THRESHOLD: 'below_threshold',
  SAVED: 'saved',
  SAVED_NO_AI: 'saved_no_ai',
  EVAL_BUDGET: 'eval_budget',
  EVAL_FAILED: 'eval_failed',
  SAVE_FAILED: 'save_failed',
} as const

export const BOT_LISTING_OUTCOME = {
  SKIPPED: 'skipped',
  REJECTED: 'rejected',
  ACCEPTED: 'accepted',
} as const

export function compactJobForAudit(job: SearchJobResult): Prisma.InputJsonValue {
  const desc = job.description ?? ''
  const truncated = desc.length > JOB_DESCRIPTION_AUDIT_MAX
  return {
    source: job.source,
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    url: job.url ?? null,
    description: truncated ? desc.slice(0, JOB_DESCRIPTION_AUDIT_MAX) : desc,
    descriptionTruncated: truncated,
    descriptionOriginalLength: desc.length,
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    salary_currency: job.salary_currency ?? null,
    job_type: job.job_type ?? null,
    is_remote: job.is_remote ?? null,
    jobBoard: job.jobBoard ?? null,
    providerPass: job.providerPass ?? null,
    posted_date: job.posted_date ?? null,
    company_logo: job.company_logo ?? null,
  } as Prisma.InputJsonValue
}

export function normalizeJobUrl(url: string): string {
  return url.trim().replace(/\/$/, '')
}

export function companyTitleKey(job: { company: string; title: string }): string {
  return `${job.company.toLowerCase().trim()}::${job.title.toLowerCase().trim()}`
}

export async function insertBotRunListings(rows: Prisma.BotRunListingCreateManyInput[]): Promise<void> {
  if (rows.length === 0) return
  const chunk = 150
  for (let i = 0; i < rows.length; i += chunk) {
    await prisma.botRunListing.createMany({ data: rows.slice(i, i + chunk) })
  }
}
