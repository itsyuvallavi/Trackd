import { JobStatus, JobPriority, JobSource, ActivityType } from '@prisma/client'

export const STATUS_LABELS: Record<JobStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  GHOSTED: 'Ghosted',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  SAVED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  APPLIED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  INTERVIEW: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  OFFER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  GHOSTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

export const PRIORITY_LABELS: Record<JobPriority, string> = {
  A: 'High Priority',
  B: 'Medium Priority',
  C: 'Low Priority',
}

export const SOURCE_LABELS: Record<JobSource, string> = {
  MANUAL: 'Manual',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  COMPANY_SITE: 'Company Site',
  REFERRAL: 'Referral',
  RECRUITER: 'Recruiter',
  EU_REMOTE_JOBS: 'EU Remote Jobs',
  WORKABLE: 'Workable',
  OTHER: 'Other',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  NOTE: 'Note',
  STATUS_CHANGE: 'Status Change',
  EMAIL_UPDATE: 'Email Update',
  INTERVIEW: 'Interview',
  REJECTION: 'Rejection',
  OFFER: 'Offer',
}
