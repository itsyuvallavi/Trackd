/**
 * When a user deletes a job, we remember URL / company+title fingerprints so the bot
 * does not re-import the same listing on the next search.
 */

import type { Prisma } from '@prisma/client'
import { companyTitleKey, normalizeJobUrl } from './bot-run-audit'

const FP_URL = 'u:'
const FP_TITLE = 't:'

export function dismissedFingerprintForUrl(url: string): string {
  return `${FP_URL}${normalizeJobUrl(url)}`
}

export function dismissedFingerprintForTitleCompany(job: { title: string; company: string }): string {
  return `${FP_TITLE}${companyTitleKey(job)}`
}

/** All fingerprints to store when a job is removed from the tracker. */
export function fingerprintsForDismissedJob(job: {
  url?: string | null
  title: string
  company: string
}): string[] {
  const out: string[] = []
  if (job.url?.trim()) out.push(dismissedFingerprintForUrl(job.url))
  out.push(dismissedFingerprintForTitleCompany(job))
  return [...new Set(out)]
}

export function dismissedRowsForUser(
  userId: string,
  job: { url?: string | null; title: string; company: string }
): Prisma.DismissedJobImportCreateManyInput[] {
  return fingerprintsForDismissedJob(job).map((fingerprint) => ({ userId, fingerprint }))
}
