import { prisma } from '@/lib/prisma'
import { createEmailService } from '@/lib/email-service'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import { ActivityType, JobStatus } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'

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
    let exactMatchesCount = 0
    let fuzzyMatchesCount = 0
    let ambiguousMatchesCount = 0
    let newJobsDetectedCount = 0
    let noMatchesCount = 0
    let notificationsCreatedCount = 0

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

        // Track match type for logging
        if (matchResult.confidence === 'exact') {
          exactMatchesCount++
        } else if (matchResult.confidence === 'fuzzy') {
          fuzzyMatchesCount++
        }

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
              notificationsCreatedCount++ // Job update notification
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
            notificationsCreatedCount++
            console.log(`Ambiguous match: ${matchResult.matchedJobs.length} jobs found for email "${email.subject}"`)
          }
        } else if (matchResult.confidence === 'none') {
          // No match found - check if we can detect a new job
          if (classified.jobInfo?.company && classified.jobInfo?.title && 
              classified.jobInfo.title !== 'Unknown Position') {
            // Normalize titles for comparison (remove extra spaces, special chars)
            const normalizeTitle = (title: string) => {
              return title.toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s]/g, '')
                .trim()
            }
            
            const emailTitleNormalized = normalizeTitle(classified.jobInfo.title)
            
            // Check for duplicate by title first (primary matching)
            // If title matches exactly or very closely, it's likely the same job
            const titleMatches = jobs.filter(job => {
              const jobTitleNormalized = normalizeTitle(job.title)
              
              // Exact match after normalization
              if (jobTitleNormalized === emailTitleNormalized) {
                return true
              }
              
              // Check if one title contains the other (for variations like "React.js / Svelte Engineer" vs "React.js / Svelte Engineer - Remote")
              if (jobTitleNormalized.includes(emailTitleNormalized) || 
                  emailTitleNormalized.includes(jobTitleNormalized)) {
                // If titles are very similar (one is subset of other), check length difference
                const lengthDiff = Math.abs(jobTitleNormalized.length - emailTitleNormalized.length)
                const shorterLength = Math.min(jobTitleNormalized.length, emailTitleNormalized.length)
                // If difference is less than 30% of shorter title, consider it a match
                if (lengthDiff < shorterLength * 0.3) {
                  return true
                }
              }
              
              // Check word overlap - if most significant words match, it's likely the same
              const emailWords = emailTitleNormalized.split(/\s+/).filter(w => w.length > 2)
              const jobWords = jobTitleNormalized.split(/\s+/).filter(w => w.length > 2)
              const commonWords = emailWords.filter(word => jobWords.includes(word))
              const matchRatio = commonWords.length / Math.max(emailWords.length, jobWords.length)
              
              // If 80%+ of words match, consider it a duplicate
              return matchRatio >= 0.8
            })
            
            if (titleMatches.length > 0) {
              console.log(`Job already exists (title match): "${classified.jobInfo.title}" matches existing job "${titleMatches[0].title}" at ${titleMatches[0].company}`)
              // Don't create notification - job already exists
            } else {
              // Also check company + title combination (secondary check)
              const companyTitleMatch = jobs.find(job => {
                const companyMatch = job.company.toLowerCase().includes(classified.jobInfo!.company!.toLowerCase()) ||
                                    classified.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
                const titleMatch = job.title.toLowerCase().includes(classified.jobInfo!.title!.toLowerCase()) ||
                                classified.jobInfo!.title!.toLowerCase().includes(job.title.toLowerCase())
                return companyMatch && titleMatch
              })

              if (!companyTitleMatch) {
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
                notificationsCreatedCount++
                console.log(`New job detected: "${classified.jobInfo.title}" at ${classified.jobInfo.company}`)
              } else {
                console.log(`Job already exists (company+title match): "${classified.jobInfo.title}" at ${classified.jobInfo.company}`)
              }
            }
          } else {
            // Insufficient info - create no-match notification
            await notificationService.createNoMatchNotification(userId, email, classified)
            noMatchesCount++
            notificationsCreatedCount++
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
        details: {
          syncSince: syncSince.toISOString(),
          jobsCount: jobs.length,
        },
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
