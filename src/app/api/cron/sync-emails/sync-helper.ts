import { prisma } from '@/lib/prisma'
import { fetchEmailsSinceForIntegration, MAX_OAUTH_MESSAGES } from '@/lib/fetch-emails-integration'
import { AIClassifier } from '@/lib/ai-email-classifier'
import { AIJobMatcher } from '@/lib/ai-job-matcher'
import { EmailType } from '@/lib/ai/types'
import { ActivityType, JobStatus } from '@prisma/client'
import { NotificationService, type SyncCompleteJobChange } from '@/lib/notification-service'
import { createEmailIdentifier } from '@/lib/email-identifiers'
import { getSeenEmailIdentifiers } from '@/lib/email-sync-dedupe'
import { parseInterviewDateTime } from '@/lib/utils/interview-date-parser'
import { alignEmailSyncLowerBound } from '@/lib/email-sync-window'
import { buildEmailSyncCursorUpdate } from '@/lib/email-sync-cursor'
import { findExistingJobForExtractedEmail } from '@/lib/email-job-dedupe'
import { runLimited } from '@/lib/run-limited'
import {
  baseEmailSyncOutcome,
  orderedEmailSyncOutcomes,
  summarizeClassification,
  summarizeMatch,
  type EmailSyncOutcome,
} from '@/lib/email-sync-outcomes'

export { createEmailIdentifier } from '@/lib/email-identifiers'

/**
 * Sync emails for a specific user (used by cron, doesn't require auth)
 */
export async function syncEmailsForUser(userId: string) {
  const syncStartTime = new Date()
  try {
    // Get email integration settings
    const integration = await prisma.emailIntegration.findUnique({
      where: { userId },
    })

    if (!integration || !integration.isActive) {
      return { success: false, error: 'Email integration not configured or inactive' }
    }

    let syncSince: Date
    let currentLastSyncedAt = integration.lastSyncedAt
    if (!integration.lastSyncedAt) {
      syncSince = alignEmailSyncLowerBound(
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      )
      console.log('📅 First sync: fetching emails from last 90 days (day-aligned lower bound)')
    } else {
      const lastSync = new Date(integration.lastSyncedAt)
      const now = new Date()
      if (lastSync > now) {
        console.log(`⚠️  lastSyncedAt is in the future, resetting to 90 days ago`)
        syncSince = alignEmailSyncLowerBound(
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        )
        await prisma.emailIntegration.update({
          where: { userId },
          data: { lastSyncedAt: syncSince },
        })
        currentLastSyncedAt = syncSince
        console.log(`📅 Sync window from ${syncSince.toISOString()} (reset)`)
      } else {
        syncSince = alignEmailSyncLowerBound(lastSync)
        console.log(
          `📅 Incremental sync: window from ${syncSince.toISOString()} (day-aligned; last run ${lastSync.toISOString()})`,
        )
      }
    }

    console.log('Starting email fetch...')
    const emails = await fetchEmailsSinceForIntegration(integration, syncSince)
    console.log(`✓ Fetched ${emails.length} emails since ${syncSince}`)

    // Get all user's jobs for matching (include contact info for better matching)
    console.log('Fetching jobs from database...')
    const jobs = await prisma.job.findMany({
      where: { userId },
      select: { 
        id: true, 
        title: true, 
        company: true, 
        url: true, 
        status: true,
        contactEmail: true,
        contactName: true,
        location: true,
      },
    })
    const jobsById = new Map(jobs.map((job) => [job.id, job]))
    console.log(`✓ Found ${jobs.length} jobs to match against`)
    
    if (jobs.length === 0) {
      console.log('⚠️  No jobs found - emails will be classified but not matched')
    }

    // Production sync is AI-reviewed. Deterministic code is only used for
    // safety checks/dedupe around AI output, not for classifying or matching.
    console.log('Starting email classification... (using AI classifier)')
    console.log('Job matching... (using AI matcher)')
    const classifier = new AIClassifier()
    const aiMatcher = new AIJobMatcher()
    const notificationService = new NotificationService()
    const seenEmailIdentifiers = await getSeenEmailIdentifiers(prisma, userId)
    const jobChanges: SyncCompleteJobChange[] = []
    let updatedCount = 0
    let processedCount = 0
    let skippedCount = 0
    let skippedOtherCount = 0
    let skippedLowConfidenceCount = 0
    let exactMatchesCount = 0
    let fuzzyMatchesCount = 0
    let ambiguousMatchesCount = 0
    let newJobsDetectedCount = 0
    let noMatchesCount = 0
    let notificationsCreatedCount = 0
    let processingErrorsCount = 0
    const emailOutcomes: EmailSyncOutcome[] = []

    const emailReviewConcurrency = Number.parseInt(
      process.env.EMAIL_SYNC_AI_CONCURRENCY ?? '6',
      10,
    )
    console.log(
      `Processing ${emails.length} emails with concurrency=${Math.min(
        Math.max(1, emailReviewConcurrency || 6),
        emails.length || 1,
      )}...`,
    )
    const processEmail = async (item: { email: (typeof emails)[number]; i: number }) => {
      const { email, i } = item
      if (i % 10 === 0) {
        console.log(`Processing email ${i + 1}/${emails.length}...`)
      }
      try {
        const emailIdentifier = createEmailIdentifier(email)
        const baseOutcome = baseEmailSyncOutcome(email, i, emailIdentifier)
        if (seenEmailIdentifiers.has(emailIdentifier)) {
          skippedCount++
          skippedOtherCount++
          emailOutcomes.push({
            ...baseOutcome,
            outcome: 'skipped_already_recorded',
            reason: 'Email identifier was already present in prior sync history or the current batch.',
          })
          console.log('Skipped already-recorded email during sync')
          return
        }
        seenEmailIdentifiers.add(emailIdentifier)

        const classified = await classifier.classify(email)
        const classification = summarizeClassification(classified)
        
        console.log(
          `Email classified: type=${classified.type}, confidence=${classified.confidence}%, hasJobInfo=${Boolean(classified.jobInfo)}`
        )

        // Check if AI says we should process this email
        if ('shouldProcess' in classified.metadata && classified.metadata.shouldProcess === false) {
          skippedCount++
          skippedOtherCount++
          emailOutcomes.push({
            ...baseOutcome,
            outcome: 'skipped_ai_not_job_related',
            reason: 'AI classifier marked shouldProcess=false.',
            classification,
          })
          console.log('Skipped non-job email during sync')
          return
        }

        // Only process job-related emails
        if (classified.type === EmailType.OTHER) {
          skippedCount++
          skippedOtherCount++
          emailOutcomes.push({
            ...baseOutcome,
            outcome: 'skipped_other',
            reason: 'AI classifier returned OTHER.',
            classification,
          })
          console.log(`Skipped OTHER email during sync (confidence: ${classified.confidence})`)
          return
        }
        
        if (classified.confidence < 20) {
          skippedCount++
          skippedLowConfidenceCount++
          emailOutcomes.push({
            ...baseOutcome,
            outcome: 'skipped_low_confidence',
            reason: `AI classification confidence ${classified.confidence}% was below the 20% processing threshold.`,
            classification,
          })
          console.log(
            `Skipped low-confidence email during sync (confidence: ${classified.confidence}%, type: ${classified.type})`
          )
          return
        }

        processedCount++
        console.log(`Processing classified email (type: ${classified.type}, confidence: ${classified.confidence}%)`)

        const matchResult = await aiMatcher.matchToJob(classified, jobs, email)
        const match = summarizeMatch(matchResult)
        
        console.log(`Match result: ${matchResult.confidence}`)
        const matchedJobId = matchResult.jobId

        // Track match type for logging
        if (matchResult.confidence === 'exact') {
          exactMatchesCount++
        } else if (matchResult.confidence === 'fuzzy') {
          fuzzyMatchesCount++
        }

        if (matchResult.confidence === 'exact' || matchResult.confidence === 'fuzzy') {
          // We have a confident match - update the job
          if (matchedJobId && classified.suggestedStatus) {
            const job = jobsById.get(matchedJobId)

            // Only update if it's a status advancement (don't go backwards)
            const shouldUpdate = shouldUpdateStatus(job?.status, classified.suggestedStatus)

            if (shouldUpdate) {
              const oldStatus = job?.status || null
              
              // Verify job still exists before updating (it might have been deleted)
              if (!job) {
                emailOutcomes.push({
                  ...baseOutcome,
                  outcome: 'matched_missing_job',
                  reason: 'AI matched a job id that was not present in the fetched job list.',
                  classification,
                  match,
                })
                console.log(`Warning: Job ${matchedJobId} no longer exists, skipping update`)
                return
              }
              
              // Parse interview date/time if this is an interview invite
              let interviewAt: Date | null = null
              if (classified.type === EmailType.INTERVIEW_INVITE && 
                  'extractedEntities' in classified.metadata && 
                  classified.metadata.extractedEntities) {
                const extracted = classified.metadata.extractedEntities as {
                  interviewDate?: string | null
                  interviewTime?: string | null
                }
                interviewAt = parseInterviewDateTime(extracted.interviewDate, extracted.interviewTime)
                
                if (interviewAt) {
                  console.log(`Setting interviewAt to ${interviewAt.toISOString()} for job ${matchedJobId}`)
                } else if (extracted.interviewDate || extracted.interviewTime) {
                  console.log(`Could not parse interview date/time from email for job ${matchedJobId} (date: ${extracted.interviewDate}, time: ${extracted.interviewTime})`)
                }
              }

              // Update job status
              try {
                await prisma.job.update({
                  where: { id: matchedJobId },
                  data: {
                    status: classified.suggestedStatus,
                    // Set interviewAt if we have a valid date/time
                    ...(interviewAt ? { interviewAt } : {}),
                  },
                })
              } catch (updateError: unknown) {
                // Handle case where job was deleted between matching and updating
                if (
                  typeof updateError === 'object' &&
                  updateError !== null &&
                  'code' in updateError &&
                  updateError.code === 'P2025'
                ) {
                  emailOutcomes.push({
                    ...baseOutcome,
                    outcome: 'matched_missing_job',
                    reason: 'Matched job disappeared before the status update could be written.',
                    classification,
                    match,
                    job: {
                      id: job.id,
                      title: job.title,
                      company: job.company,
                      previousStatus: oldStatus,
                      newStatus: classified.suggestedStatus,
                    },
                  })
                  console.log(`Warning: Job ${matchedJobId} was deleted, skipping update`)
                  return
                }
                throw updateError // Re-throw other errors
              }

              // Create activity record with AI-extracted metadata
              const activityMetadata: Record<string, unknown> = {
                emailIdentifier, // Store unique identifier to prevent duplicates
                emailSubject: email.subject,
                emailFrom: email.from,
                emailDate: email.date.toISOString(),
              }

              // Add AI-extracted entities if available
              if ('extractedEntities' in classified.metadata && classified.metadata.extractedEntities) {
                const extracted = classified.metadata.extractedEntities as {
                  interviewDate?: string | null
                  interviewTime?: string | null
                  nextSteps?: string[]
                  contactName?: string | null
                  contactEmail?: string | null
                  salary?: string | null
                  rejectionReason?: string | null
                }
                if (extracted.interviewDate) activityMetadata.interviewDate = extracted.interviewDate
                if (extracted.interviewTime) activityMetadata.interviewTime = extracted.interviewTime
                if (extracted.nextSteps && extracted.nextSteps.length > 0) activityMetadata.nextSteps = extracted.nextSteps
                if (extracted.contactName) activityMetadata.contactName = extracted.contactName
                if (extracted.contactEmail) activityMetadata.contactEmail = extracted.contactEmail
                if (extracted.salary) activityMetadata.salary = extracted.salary
                if (extracted.rejectionReason) activityMetadata.rejectionReason = extracted.rejectionReason
              }

              await prisma.activity.create({
                data: {
                  jobId: matchedJobId,
                  userId,
                  type: getActivityType(classified.type),
                  fromStatus: oldStatus,
                  toStatus: classified.suggestedStatus,
                  description: `Email detected: ${email.subject}`,
                  // @ts-expect-error - metadata field exists in database but may not be in generated types yet
                  metadata: activityMetadata,
                },
              })

              jobChanges.push({
                jobId: matchedJobId,
                title: job.title,
                company: job.company,
                oldStatus: oldStatus,
                newStatus: classified.suggestedStatus,
                emailSubject: email.subject,
                interviewAtIso: interviewAt ? interviewAt.toISOString() : null,
              })

              // Timeline already records the update; skip JOB_UPDATED notification to avoid duplicating the dashboard bell + feed

              updatedCount++
              emailOutcomes.push({
                ...baseOutcome,
                outcome: 'updated_job',
                reason: 'Matched email advanced the job status.',
                classification,
                match,
                job: {
                  id: job.id,
                  title: job.title,
                  company: job.company,
                  previousStatus: oldStatus,
                  newStatus: classified.suggestedStatus,
                },
              })
              console.log(`Updated job ${matchedJobId} to status ${classified.suggestedStatus}`)
            } else {
              emailOutcomes.push({
                ...baseOutcome,
                outcome: 'matched_no_change',
                reason: 'Matched email did not advance the existing job status.',
                classification,
                match,
                job: job
                  ? {
                      id: job.id,
                      title: job.title,
                      company: job.company,
                      previousStatus: job.status,
                      newStatus: classified.suggestedStatus,
                    }
                  : undefined,
              })
              console.log(`Skipped updating job ${matchedJobId} - status would go backwards`)
            }
          }
        } else if (matchResult.confidence === 'ambiguous') {
          // Multiple jobs match - create notification for user to choose
          if (matchResult.matchedJobs && matchResult.matchedJobs.length > 0) {
            await notificationService.createAmbiguousMatchNotification(
              userId,
              email,
              matchResult.matchedJobs,
              classified
            )
            ambiguousMatchesCount++
            notificationsCreatedCount++
            emailOutcomes.push({
              ...baseOutcome,
              outcome: 'ambiguous_review',
              reason: 'AI matcher found multiple plausible jobs and created a review notification.',
              classification,
              match,
              notificationCreated: true,
            })
            console.log(`Ambiguous email match: ${matchResult.matchedJobs.length} candidate jobs`)
          }
        } else if (matchResult.confidence === 'none') {
          // No match found - check if we can detect a new job
          if (classified.jobInfo?.company && classified.jobInfo?.title && 
              classified.jobInfo.title !== 'Unknown Position') {
            const existingJob = findExistingJobForExtractedEmail(classified.jobInfo, jobs)

            if (!existingJob) {
              await notificationService.createNewJobDetectedNotification(
                userId,
                email,
                classified,
                {
                  company: classified.jobInfo.company,
                  title: classified.jobInfo.title,
                  location: classified.jobInfo.location,
                }
              )
              newJobsDetectedCount++
              notificationsCreatedCount++
              emailOutcomes.push({
                ...baseOutcome,
                outcome: 'new_job_review',
                reason: 'AI extracted a job not found in the existing application list and created a review notification.',
                classification,
                match,
                notificationCreated: true,
              })
              console.log('New job detected from email sync')
            } else {
              emailOutcomes.push({
                ...baseOutcome,
                outcome: 'existing_job_detected',
                reason: 'AI extracted job details, but deterministic company/title dedupe found an existing job.',
                classification,
                match,
                job: {
                  id: existingJob.id,
                  title: existingJob.title,
                  company: existingJob.company,
                  previousStatus: existingJob.status,
                  newStatus: classified.suggestedStatus,
                },
              })
              console.log('Email-detected job matched an existing job')
            }
          } else {
            // Insufficient info - create no-match notification
            await notificationService.createNoMatchNotification(userId, email, classified)
            noMatchesCount++
            notificationsCreatedCount++
            emailOutcomes.push({
              ...baseOutcome,
              outcome: 'no_match_review',
              reason: 'AI marked the email as job-related but did not extract enough job info to match or create a job.',
              classification,
              match,
              notificationCreated: true,
            })
            console.log('No match found and insufficient job info extracted from email')
          }
        }
      } catch (error) {
        processingErrorsCount++
        const emailIdentifier = createEmailIdentifier(email)
        emailOutcomes.push({
          ...baseEmailSyncOutcome(email, i, emailIdentifier),
          outcome: 'processing_error',
          reason: 'Email processing threw an exception.',
          error: error instanceof Error ? error.message : String(error),
        })
        console.error('Error processing email during sync:', error)
        // Continue processing other emails
      }
    }
    await runLimited(
      emails.map((email, i) => ({ email, i })),
      emailReviewConcurrency || 6,
      processEmail,
    )

    console.log(`Sync complete: ${processedCount} processed, ${updatedCount} updated, ${skippedCount} skipped`)
    console.log(`  - Updated jobs: ${updatedCount}`)
    console.log(`  - New jobs detected: ${newJobsDetectedCount}`)
    console.log(`  - Ambiguous matches: ${ambiguousMatchesCount}`)
    console.log(`  - No matches: ${noMatchesCount}`)
    console.log(`  - Processing errors: ${processingErrorsCount}`)

    const cursorUpdate = buildEmailSyncCursorUpdate({
      currentLastSyncedAt,
      fetchedEmailsCount: emails.length,
      maxFetchedEmails: MAX_OAUTH_MESSAGES,
      processingErrorsCount,
    })

    // Only advance the cursor after a complete run. OAuth providers cap messages
    // per request, and per-email errors are retried on the next scan.
    console.log('Updating sync status...')
    await prisma.emailIntegration.update({
      where: { userId },
      data: {
        lastSyncedAt: cursorUpdate.nextLastSyncedAt,
        lastError: cursorUpdate.lastError,
      },
    })
    console.log(
      cursorUpdate.completedFullWindow
        ? '✓ Last synced timestamp advanced'
        : '⚠️ Partial sync recorded; last synced timestamp was not advanced',
    )

    const stats = {
      totalEmails: emails.length,
      processedEmails: processedCount,
      createdJobs: 0, // No longer creating jobs automatically
      updatedJobs: updatedCount,
      skippedEmails: skippedCount,
      ambiguousMatches: ambiguousMatchesCount,
      newJobsDetected: newJobsDetectedCount,
      noMatches: noMatchesCount,
      skippedOther: skippedOtherCount,
      skippedLowConfidence: skippedLowConfidenceCount,
      syncSince: syncSince.toISOString(),
      processingErrors: processingErrorsCount,
      partial: !cursorUpdate.completedFullWindow,
    }

    // Create sync complete notification
    await notificationService.createSyncCompleteNotification(userId, stats, jobChanges)
    notificationsCreatedCount++ // Sync complete notification

    const syncCompletedAt = new Date()
    const syncDuration = syncCompletedAt.getTime() - syncStartTime.getTime()

    // Save sync log to database
    // Note: If you get "Cannot read properties of undefined (reading 'create')", 
    // restart your dev server after running `prisma generate`
    try {
      await prisma.emailSyncLog.create({
      data: {
        userId,
        startedAt: syncStartTime,
        completedAt: syncCompletedAt,
        duration: syncDuration,
        source: 'cron',
        totalEmails: emails.length,
        processedEmails: processedCount,
        skippedEmails: skippedCount,
        skippedOther: skippedOtherCount,
        skippedLowConfidence: skippedLowConfidenceCount,
        exactMatches: exactMatchesCount,
        fuzzyMatches: fuzzyMatchesCount,
        ambiguousMatches: ambiguousMatchesCount,
        newJobsDetected: newJobsDetectedCount,
        noMatches: noMatchesCount,
        jobsUpdated: updatedCount,
        notificationsCreated: notificationsCreatedCount,
        success: true,
        details: JSON.parse(JSON.stringify({
          syncSince: syncSince.toISOString(),
          jobsCount: jobs.length,
          partial: !cursorUpdate.completedFullWindow,
          processingErrors: processingErrorsCount,
          reachedFetchCap: cursorUpdate.reachedFetchCap,
          emailOutcomes: orderedEmailSyncOutcomes(emailOutcomes),
        })),
      },
      })
    } catch (logError) {
      // If emailSyncLog model doesn't exist, log warning but don't fail the sync
      console.warn('Failed to save sync log (model may not be available). Run: bunx prisma generate && restart server', logError)
    }

    return {
      success: true,
      stats,
    }
  } catch (error) {
    console.error('Email sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log error to database
    try {
      await prisma.emailIntegration.update({
        where: { userId },
        data: {
          lastError: errorMessage,
        },
      })
      
      // Create error notification
      const notificationService = new NotificationService()
      await notificationService.createSyncErrorNotification(userId, errorMessage)

      // Save error sync log (only if model exists)
      const syncCompletedAt = new Date()
      try {
        await prisma.emailSyncLog.create({
          data: {
            userId,
            startedAt: syncStartTime,
            completedAt: syncCompletedAt,
            duration: syncCompletedAt.getTime() - syncStartTime.getTime(),
            source: 'cron',
            totalEmails: 0,
            processedEmails: 0,
            skippedEmails: 0,
            skippedOther: 0,
            skippedLowConfidence: 0,
            exactMatches: 0,
            fuzzyMatches: 0,
            ambiguousMatches: 0,
            newJobsDetected: 0,
            noMatches: 0,
            jobsUpdated: 0,
            notificationsCreated: 1, // Error notification
            success: false,
            errorMessage,
          },
        })
      } catch (logError) {
        console.error('Failed to save error sync log:', logError)
      }
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError)
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Determine if we should update the job status based on the current and suggested status
 * Only advance status, never go backwards
 */
export function shouldUpdateStatus(
  currentStatus: JobStatus | undefined,
  suggestedStatus: JobStatus
): boolean {
  if (!currentStatus) return true

  const statusHierarchy = {
    SAVED: 0,
    APPLIED: 1,
    INTERVIEW: 2,
    OFFER: 3,
    REJECTED: 99,
    ARCHIVED: 99,
  }

  const currentLevel = statusHierarchy[currentStatus]
  const suggestedLevel = statusHierarchy[suggestedStatus]

  // Only update if suggested status is higher (advancing) or if it's a rejection
  return suggestedLevel > currentLevel || suggestedStatus === JobStatus.REJECTED
}

/**
 * Map email type to activity type
 */
function getActivityType(emailType: EmailType): ActivityType {
  switch (emailType) {
    case EmailType.APPLICATION_CONFIRMATION:
      return ActivityType.STATUS_CHANGE
    case EmailType.INTERVIEW_INVITE:
      return ActivityType.INTERVIEW
    case EmailType.REJECTION:
      return ActivityType.REJECTION
    case EmailType.OFFER:
      return ActivityType.OFFER
    default:
      return ActivityType.EMAIL_UPDATE
  }
}
