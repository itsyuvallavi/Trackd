import { prisma } from '@/lib/prisma'
import { createEmailService } from '@/lib/email-service'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import { ActivityType, JobStatus } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'

/**
 * Sync emails for a specific user (used by cron, doesn't require auth)
 */
export async function syncEmailsForUser(userId: string) {
  try {
    // Get email integration settings
    const integration = await prisma.emailIntegration.findUnique({
      where: { userId },
    })

    if (!integration || !integration.isActive) {
      return { success: false, error: 'Email integration not configured or inactive' }
    }

    // Determine the date to sync from
    let syncSince: Date
    if (!integration.lastSyncedAt) {
      // First sync: go back 90 days
      syncSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      console.log('📅 First sync: fetching emails from last 90 days')
    } else {
      const lastSync = new Date(integration.lastSyncedAt)
      const now = new Date()
      if (lastSync > now) {
        console.log(`⚠️  lastSyncedAt is in the future, resetting to 90 days ago`)
        syncSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        await prisma.emailIntegration.update({
          where: { userId },
          data: { lastSyncedAt: syncSince },
        })
      } else {
        syncSince = lastSync
      }
      console.log(`📅 Incremental sync: fetching emails since ${syncSince.toISOString()}`)
    }

    // Only process integrations with IMAP config
    if (!integration.imapHost || !integration.imapPort || !integration.imapUsername || !integration.imapPassword) {
      return { success: false, error: 'Missing IMAP configuration' }
    }

    // Fetch emails using the user's IMAP settings
    const emailService = createEmailService({
      host: integration.imapHost,
      port: integration.imapPort,
      user: integration.imapUsername,
      password: integration.imapPassword,
    })
    console.log('Starting email fetch...')
    const emails = await emailService.fetchEmailsSince(syncSince)
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
    console.log(`✓ Found ${jobs.length} jobs to match against`)
    
    if (jobs.length === 0) {
      console.log('⚠️  No jobs found - emails will be classified but not matched')
    }

    // Classify and process each email
    console.log('Starting email classification...')
    const classifier = new EmailClassifier()
    const notificationService = new NotificationService()
    let updatedCount = 0
    let processedCount = 0
    let skippedCount = 0
    let skippedOtherCount = 0
    let skippedLowConfidenceCount = 0
    let ambiguousMatchesCount = 0
    let newJobsDetectedCount = 0
    let noMatchesCount = 0

    console.log(`Processing ${emails.length} emails...`)
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]
      if (i % 10 === 0) {
        console.log(`Processing email ${i + 1}/${emails.length}...`)
      }
      try {
        const classified = classifier.classify(email)
        console.log(`Email "${email.subject}": type=${classified.type}, confidence=${classified.confidence}%, jobInfo=`, classified.jobInfo)

        // Only process job-related emails
        if (classified.type === EmailType.OTHER) {
          skippedCount++
          skippedOtherCount++
          console.log(`Skipped email "${email.subject}" - classified as OTHER (confidence: ${classified.confidence})`)
          continue
        }
        
        if (classified.confidence < 20) {
          skippedCount++
          skippedLowConfidenceCount++
          console.log(`Skipped email "${email.subject}" - low confidence: ${classified.confidence}% (type: ${classified.type})`)
          continue
        }

        processedCount++
        console.log(`Processing email: ${email.subject} (type: ${classified.type}, confidence: ${classified.confidence}%)`)

        // Try to match email to existing job using enhanced matching
        const matchResult = classifier.matchToJob(classified, jobs, email)

        if (matchResult.confidence === 'exact' || matchResult.confidence === 'fuzzy') {
          // We have a confident match - update the job
          if (matchResult.jobId && classified.suggestedStatus) {
            const job = jobs.find((j) => j.id === matchResult.jobId)

            // Only update if it's a status advancement (don't go backwards)
            const shouldUpdate = shouldUpdateStatus(job?.status, classified.suggestedStatus)

            if (shouldUpdate) {
              const oldStatus = job?.status || null
              
              // Update job status
              await prisma.job.update({
                where: { id: matchResult.jobId },
                data: { status: classified.suggestedStatus },
              })

              // Create activity record
              await prisma.activity.create({
                data: {
                  jobId: matchResult.jobId,
                  userId,
                  type: getActivityType(classified.type),
                  fromStatus: oldStatus,
                  toStatus: classified.suggestedStatus,
                  description: `Email detected: ${email.subject}`,
                },
              })

              // Create notification for job update
              await notificationService.createJobUpdatedNotification(
                userId,
                matchResult.jobId,
                job?.title || 'Unknown',
                job?.company || 'Unknown',
                oldStatus,
                classified.suggestedStatus,
                'email'
              )

              updatedCount++
              console.log(`Updated job ${matchResult.jobId} to status ${classified.suggestedStatus}`)
            } else {
              console.log(`Skipped updating job ${matchResult.jobId} - status would go backwards`)
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
            console.log(`Ambiguous match: ${matchResult.matchedJobs.length} jobs found for email "${email.subject}"`)
          }
        } else if (matchResult.confidence === 'none') {
          // No match found - check if we can detect a new job
          if (classified.jobInfo?.company && classified.jobInfo?.title && 
              classified.jobInfo.title !== 'Unknown Position') {
            // Check if this company + title combination already exists
            const existingJob = jobs.find(job => {
              const companyMatch = job.company.toLowerCase().includes(classified.jobInfo!.company!.toLowerCase()) ||
                                  classified.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
              const titleMatch = job.title.toLowerCase().includes(classified.jobInfo!.title!.toLowerCase()) ||
                                classified.jobInfo!.title!.toLowerCase().includes(job.title.toLowerCase())
              return companyMatch && titleMatch
            })

            if (!existingJob) {
              // New job detected - create notification
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
              console.log(`New job detected: "${classified.jobInfo.title}" at ${classified.jobInfo.company}`)
            } else {
              console.log(`Job already exists: "${classified.jobInfo.title}" at ${classified.jobInfo.company}`)
            }
          } else {
            // Insufficient info - create no-match notification
            await notificationService.createNoMatchNotification(userId, email, classified)
            noMatchesCount++
            console.log(`No match found and insufficient info for email "${email.subject}"`)
          }
        }
      } catch (error) {
        console.error(`Error processing email "${email.subject}":`, error)
        // Continue processing other emails
      }
    }

    console.log(`Sync complete: ${processedCount} processed, ${updatedCount} updated, ${skippedCount} skipped`)
    console.log(`  - Updated jobs: ${updatedCount}`)
    console.log(`  - New jobs detected: ${newJobsDetectedCount}`)
    console.log(`  - Ambiguous matches: ${ambiguousMatchesCount}`)
    console.log(`  - No matches: ${noMatchesCount}`)

    // Update last synced timestamp
    console.log('Updating last synced timestamp...')
    await prisma.emailIntegration.update({
      where: { userId },
      data: {
        lastSyncedAt: new Date(),
        lastError: null,
      },
    })
    console.log('✓ Last synced timestamp updated')

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
    }

    // Create sync complete notification
    await notificationService.createSyncCompleteNotification(userId, stats)

    return {
      success: true,
      stats,
    }
  } catch (error) {
    console.error('Email sync error:', error)

    // Log error to database
    try {
      await prisma.emailIntegration.update({
        where: { userId },
        data: {
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      
      // Create error notification
      const notificationService = new NotificationService()
      await notificationService.createSyncErrorNotification(
        userId,
        error instanceof Error ? error.message : 'Unknown error'
      )
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync emails',
    }
  }
}

/**
 * Determine if we should update the job status based on the current and suggested status
 * Only advance status, never go backwards
 */
function shouldUpdateStatus(
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
    GHOSTED: 99,
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
