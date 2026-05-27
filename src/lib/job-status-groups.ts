import type { JobStatus } from '@prisma/client'

export const ACTIVE_APPLICATION_STATUSES = new Set<JobStatus>([
  'APPLIED',
  'INTERVIEW',
  'OFFER',
])

export function isActiveApplicationStatus(status: string | JobStatus): boolean {
  return ACTIVE_APPLICATION_STATUSES.has(status as JobStatus)
}
