import { JobStatus } from '@prisma/client'
import { ClassifiedEmail } from '@/lib/ai-email-classifier'
import { EmailMessage } from '@/lib/email-service'
import { MatchResult } from '@/lib/email-classifier'

export type EmailSyncOutcomeStatus =
  | 'updated_job'
  | 'matched_no_change'
  | 'matched_missing_job'
  | 'duplicate_email'
  | 'skipped_already_recorded'
  | 'skipped_ai_not_job_related'
  | 'skipped_other'
  | 'skipped_low_confidence'
  | 'ambiguous_review'
  | 'new_job_review'
  | 'existing_job_detected'
  | 'no_match_review'
  | 'processing_error'

export interface EmailSyncOutcome {
  index: number
  emailIdentifier: string
  subject: string
  from: string
  date: string
  outcome: EmailSyncOutcomeStatus
  reason: string
  classification?: {
    type: string
    confidence: number
    suggestedStatus?: JobStatus
    shouldProcess?: boolean
    company?: string | null
    title?: string | null
  }
  match?: {
    confidence: MatchResult['confidence']
    reason: string
    jobId?: string | null
    matchedJobs?: Array<{ id: string; title: string; company: string }>
  }
  job?: {
    id: string
    title: string
    company: string
    previousStatus?: JobStatus | null
    newStatus?: JobStatus | null
  }
  notificationCreated?: boolean
  error?: string
}

export function baseEmailSyncOutcome(
  email: EmailMessage,
  index: number,
  emailIdentifier: string,
): Pick<EmailSyncOutcome, 'index' | 'emailIdentifier' | 'subject' | 'from' | 'date'> {
  return {
    index,
    emailIdentifier,
    subject: email.subject,
    from: email.from,
    date: email.date.toISOString(),
  }
}

export function summarizeClassification(classified: ClassifiedEmail): EmailSyncOutcome['classification'] {
  const metadata = classified.metadata as { shouldProcess?: boolean }
  return {
    type: classified.type,
    confidence: classified.confidence,
    suggestedStatus: classified.suggestedStatus,
    shouldProcess: metadata.shouldProcess,
    company: classified.jobInfo?.company ?? null,
    title: classified.jobInfo?.title ?? null,
  }
}

export function summarizeMatch(matchResult: MatchResult): EmailSyncOutcome['match'] {
  return {
    confidence: matchResult.confidence,
    reason: matchResult.reason,
    jobId: matchResult.jobId,
    matchedJobs: matchResult.matchedJobs,
  }
}

export function orderedEmailSyncOutcomes(outcomes: EmailSyncOutcome[]) {
  return [...outcomes].sort((a, b) => a.index - b.index)
}
