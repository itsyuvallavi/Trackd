import { JobStatus, JobPriority, JobSource, ActivityType } from '@prisma/client'

export const STATUS_LABELS: Record<JobStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  SAVED: 'bg-muted text-muted-foreground border border-border',
  APPLIED: 'bg-info-bg text-info-text border border-info/20',
  INTERVIEW: 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-200',
  OFFER: 'bg-success-bg text-success-text border border-success/20',
  REJECTED: 'bg-error-bg text-error-text border border-error/20',
  ARCHIVED: 'bg-warning-bg text-warning-text border border-warning/20',
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
  BOT: 'Bot',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  NOTE: 'Note',
  STATUS_CHANGE: 'Status Change',
  EMAIL_UPDATE: 'Email Update',
  INTERVIEW: 'Interview',
  REJECTION: 'Rejection',
  OFFER: 'Offer',
}
