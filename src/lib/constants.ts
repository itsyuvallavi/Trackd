import { JobStatus, JobPriority, JobSource, ActivityType } from '@prisma/client'

export const STATUS_LABELS: Record<JobStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
}

// Glass status pills: translucent tinted fill + readable text, one token per status.
// See `globals.css` for the underlying OKLCH tokens.
export const STATUS_COLORS: Record<JobStatus, string> = {
  SAVED: 'bg-saved-bg text-saved-text border border-saved/20',
  APPLIED: 'bg-info-bg text-info-text border border-info/20',
  INTERVIEW: 'bg-interview-bg text-interview-text border border-interview/20',
  OFFER: 'bg-success-bg text-success-text border border-success/20',
  REJECTED: 'bg-error-bg text-error-text border border-error/20',
  ARCHIVED: 'bg-warning-bg text-warning-text border border-warning/20',
}

/**
 * Solid color token (foreground-color style) per status.
 * Use to style the morphing dot in the glass status pill, status accent
 * bars, or chart series.
 */
export const STATUS_DOT_COLOR: Record<JobStatus, string> = {
  SAVED: 'bg-saved',
  APPLIED: 'bg-info',
  INTERVIEW: 'bg-interview',
  OFFER: 'bg-success',
  REJECTED: 'bg-error',
  ARCHIVED: 'bg-warning',
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
  ZIPRECRUITER: 'ZipRecruiter',
  LANDING_JOBS: 'Landing.jobs',
  OTHER: 'Other',
  /** Only when `Job.importSource` is missing — prefer fixing data over showing this. */
  BOT: 'Unknown API',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  NOTE: 'Note',
  STATUS_CHANGE: 'Status Change',
  EMAIL_UPDATE: 'Email Update',
  INTERVIEW: 'Interview',
  REJECTION: 'Rejection',
  OFFER: 'Offer',
}

/** Fired when a manual bot run finishes so client views can refetch (queue API, etc.). */
export const BOT_RUN_COMPLETE_EVENT = 'trackd:bot-run-complete' as const

/** Fired after email sync (or similar) so the notification bell can refetch. */
export const NOTIFICATIONS_REFRESH_EVENT = 'trackd:notifications-refresh' as const
