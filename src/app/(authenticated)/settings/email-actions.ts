'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createEmailService } from '@/lib/email-service'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import { AIClassifier } from '@/lib/ai-email-classifier'
import { AIJobMatcher } from '@/lib/ai-job-matcher'
import { ActivityType, JobStatus, Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'
import { ExtractedEntities } from '@/lib/ai/types'
import { createHash } from 'crypto'
import { parseInterviewDateTime } from '@/lib/utils/interview-date-parser'
import { cacheTagsFor } from '@/lib/cache-tags'

/**
 * Create a unique identifier for an email to prevent duplicate processing
 */
function createEmailIdentifier(email: { id?: string; subject: string; from: string; date: Date }): string {
  // Use messageId if available (most reliable)
  if (email.id && email.id.includes('@') && !email.id.includes('Date.now()')) {
    return email.id
  }
  
  // Otherwise, create a hash from subject + from + date
  // Normalize the date to the day (ignore time) to handle timezone differences
  const dateStr = email.date.toISOString().split('T')[0] // YYYY-MM-DD
  const hashInput = `${email.subject}|${email.from}|${dateStr}`
  return createHash('sha256').update(hashInput).digest('hex').substring(0, 32)
}

/**
 * Check if an email has already been processed for a specific job
 */
async function isEmailAlreadyProcessed(
  userId: string,
  jobId: string,
  emailIdentifier: string
): Promise<boolean> {
  // Fetch recent activities for this job and check metadata in memory
  // This is more reliable than Prisma JSON path queries
  const recentActivities = await prisma.activity.findMany({
    where: {
      userId,
      jobId,
      // Only check activities from the last 90 days to limit query size
      createdAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      metadata: true,
    },
    take: 100, // Limit to most recent 100 activities
  })
  
  // Check if any activity has the same emailIdentifier
  return recentActivities.some(activity => {
    if (!activity.metadata || typeof activity.metadata !== 'object') {
      return false
    }
    const metadata = activity.metadata as { emailIdentifier?: string }
    return metadata.emailIdentifier === emailIdentifier
  })
}

/**
 * Sync emails and update jobs based on email content
 * Always uses incremental sync (since lastSyncedAt) to avoid double-scanning
 */
export async function syncEmails() {
  let userId: string | null = null
  const syncStartTime = new Date()

  try {
    const user = await requireAuth()
    userId = user.id

    // Get email integration settings
    const integration = await prisma.emailIntegration.findUnique({
      where: { userId },
    })

    if (!integration || !integration.isActive) {
      return { success: false, error: 'Email integration not configured' }
    }

    // Determine the date to sync from
    // Always use incremental sync (since lastSyncedAt) to avoid double-scanning
    // If lastSyncedAt is in the future (data issue), reset it to 90 days ago
    // If never synced, start from 90 days ago for initial sync
    let syncSince: Date
    if (!integration.lastSyncedAt) {
      // First sync: go back 90 days
      syncSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      console.log('📅 First sync: fetching emails from last 90 days')
    } else {
      const lastSync = new Date(integration.lastSyncedAt)
      const now = new Date()
      // If lastSyncedAt is in the future (data corruption/timezone issue), reset to 90 days ago
      if (lastSync > now) {
        console.log(`⚠️  lastSyncedAt is in the future (${lastSync.toISOString()}), resetting to 90 days ago`)
        syncSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        // Also update the database to fix the corrupted date
        await prisma.emailIntegration.update({
          where: { userId },
          data: { lastSyncedAt: syncSince },
        })
      } else {
        syncSince = lastSync
      }
      console.log(`📅 Incremental sync: fetching emails since ${syncSince.toISOString()}`)
    }

    // Fetch emails using the user's IMAP settings
    const emailService = createEmailService({
      host: integration.imapHost!,
      port: integration.imapPort!,
      user: integration.imapUsername!,
      password: integration.imapPassword!,
    })
    console.log('Starting email fetch...')
    const emails = await emailService.fetchEmailsSince(syncSince)
    console.log(`✓ Fetched ${emails.length} emails since ${syncSince}`)
    console.log('Emails array:', emails.slice(0, 2).map(e => ({ subject: e.subject, from: e.from }))) // Log first 2 for debugging

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
    // Feature flags
    const USE_AI_CLASSIFIER = process.env.ENABLE_AI_CLASSIFICATION === 'true'
    const USE_AI_MATCHING = process.env.ENABLE_AI_MATCHING === 'true'

    console.log(`Starting email classification... (using ${USE_AI_CLASSIFIER ? 'AI' : 'keyword-based'} classifier)`)
    const classifier = USE_AI_CLASSIFIER ? new AIClassifier() : new EmailClassifier()
    const matcher = USE_AI_MATCHING ? new AIJobMatcher() : new EmailClassifier() // Use AIJobMatcher or EmailClassifier for matching
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
        // Classify email (AI classifier is async, keyword-based is sync)
        const classified = USE_AI_CLASSIFIER
          ? await (classifier as AIClassifier).classify(email)
          : (classifier as EmailClassifier).classify(email)

        console.log(`Email "${email.subject}": type=${classified.type}, confidence=${classified.confidence}%, jobInfo=`, classified.jobInfo)

        // Check if AI determined email should not be processed
        if (USE_AI_CLASSIFIER && 'shouldProcess' in classified.metadata && classified.metadata.shouldProcess === false) {
          skippedCount++
          skippedOtherCount++
          console.log(`Skipped email "${email.subject}" - AI determined it's not job-related (shouldProcess=false)`)
          continue
        }

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

        // Try to match email to existing job (AI matcher is async, keyword-based is sync)
        console.log(`Starting job matching... (using ${USE_AI_MATCHING ? 'AI' : 'keyword-based'} matcher)`)
        const matchResult = USE_AI_MATCHING
          ? await (matcher as AIJobMatcher).matchToJob(classified, jobs)
          : (matcher as EmailClassifier).matchToJob(classified, jobs, email)

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

            // Create unique identifier for this email
            const emailIdentifier = createEmailIdentifier(email)
            
            // Check if this email has already been processed for this job
            const alreadyProcessed = await isEmailAlreadyProcessed(userId, matchResult.jobId, emailIdentifier)
            
            if (alreadyProcessed) {
              console.log(`Skipped duplicate email "${email.subject}" for job ${matchResult.jobId} (already processed)`)
              continue
            }

            // Only update if it's a status advancement (don't go backwards)
            const shouldUpdate = shouldUpdateStatus(job?.status, classified.suggestedStatus)

            if (shouldUpdate) {
              const oldStatus = job?.status || null
              
              // Verify job still exists before updating (it might have been deleted)
              if (!job) {
                console.log(`Warning: Job ${matchResult.jobId} no longer exists, skipping update`)
                continue
              }
              
              // Parse interview date/time if this is an interview invite
              let interviewAt: Date | null = null
              if (classified.type === EmailType.INTERVIEW_INVITE && 
                  USE_AI_CLASSIFIER &&
                  'extractedEntities' in classified.metadata && 
                  classified.metadata.extractedEntities) {
                const extracted = classified.metadata.extractedEntities as ExtractedEntities
                interviewAt = parseInterviewDateTime(extracted.interviewDate, extracted.interviewTime)
                
                if (interviewAt) {
                  console.log(`Setting interviewAt to ${interviewAt.toISOString()} for job ${matchResult.jobId}`)
                } else if (extracted.interviewDate || extracted.interviewTime) {
                  console.log(`Could not parse interview date/time from email for job ${matchResult.jobId} (date: ${extracted.interviewDate}, time: ${extracted.interviewTime})`)
                }
              }

              // Update job status
              try {
                await prisma.job.update({
                  where: { id: matchResult.jobId },
                  data: {
                    status: classified.suggestedStatus,
                    // Set interviewAt if we have a valid date/time
                    ...(interviewAt ? { interviewAt } : {}),
                  },
                })
              } catch (updateError: any) {
                // Handle case where job was deleted between matching and updating
                if (updateError?.code === 'P2025') {
                  console.log(`Warning: Job ${matchResult.jobId} was deleted, skipping update`)
                  continue
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

              // Add AI-extracted entities to metadata if available
              if (USE_AI_CLASSIFIER && 'extractedEntities' in classified.metadata && classified.metadata.extractedEntities) {
                const extracted = classified.metadata.extractedEntities as ExtractedEntities
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
                  jobId: matchResult.jobId,
                  userId,
                  type: getActivityType(classified.type),
                  fromStatus: oldStatus,
                  toStatus: classified.suggestedStatus,
                  description: `Email detected: ${email.subject}`,
                  metadata: activityMetadata as Prisma.InputJsonValue,
                },
              })

              // Activity feed captures the change; no separate JOB_UPDATED notification for email sync

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
    console.log(`  - Skipped (OTHER): ${skippedOtherCount}`)
    console.log(`  - Skipped (low confidence): ${skippedLowConfidenceCount}`)
    console.log(`  - Fetched since: ${syncSince.toISOString()}`)
    console.log(`  - Total emails fetched: ${emails.length}`)

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

    console.log('Revalidating paths...')
    const tags = cacheTagsFor(userId)
    revalidateTag(tags.jobs, { expire: 0 })
    revalidateTag(tags.activity, { expire: 0 })
    revalidateTag(tags.notifications, { expire: 0 })
    revalidateTag(tags.email, { expire: 0 })
    revalidatePath('/jobs')
    revalidatePath('/today')
    revalidatePath('/board')
    revalidatePath('/settings/integrations')
    revalidatePath('/dashboard')
    console.log('✓ Paths revalidated')

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
    try {
      await prisma.emailSyncLog.create({
      data: {
        userId,
        startedAt: syncStartTime,
        completedAt: syncCompletedAt,
        duration: syncDuration,
        source: 'manual',
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

    const result = {
      success: true,
      stats,
    }
    console.log('Returning result:', result)
    return result
  } catch (error) {
    console.error('Email sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log error to database and create notification
    if (userId) {
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
            source: 'manual',
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
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync emails',
    }
  }
}

/**
 * Save email integration settings
 */
export async function saveEmailIntegration(formData: FormData) {
  const user = await requireAuth()
  const userId = user.id

  const email = formData.get('email') as string
  const imapHost = formData.get('imapHost') as string
  const imapPort = parseInt(formData.get('imapPort') as string)
  const imapUsername = formData.get('imapUsername') as string
  const imapPassword = formData.get('imapPassword') as string

  try {
    // Test connection first using the provided settings
    const emailService = createEmailService({
      host: imapHost,
      port: imapPort,
      user: imapUsername,
      password: imapPassword,
    })
    await emailService.testConnection()

    // Save to database
    await prisma.emailIntegration.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'IMAP',
        email,
        imapHost,
        imapPort,
        imapUsername,
        imapPassword,
        isActive: true,
      },
      update: {
        email,
        imapHost,
        imapPort,
        imapUsername,
        imapPassword,
        isActive: true,
        lastError: null,
      },
    })

    revalidateTag(cacheTagsFor(userId).email, { expire: 0 })
    revalidatePath('/settings/integrations')

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save settings',
    }
  }
}

/**
 * Test email connection
 */
export async function testEmailConnection() {
  try {
    const user = await requireAuth()

    const integration = await prisma.emailIntegration.findUnique({
      where: { userId: user.id },
    })

    if (!integration) {
      return {
        success: false,
        error: 'Email integration not configured. Please save your settings first.',
      }
    }

    const emailService = createEmailService({
      host: integration.imapHost!,
      port: integration.imapPort!,
      user: integration.imapUsername!,
      password: integration.imapPassword!,
    })

    await emailService.testConnection()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

/**
 * Update auto-sync settings
 */
export async function updateAutoSyncSettings(
  autoSyncEnabled: boolean,
  autoSyncFrequency: number
) {
  try {
    const user = await requireAuth()

    const integration = await prisma.emailIntegration.findUnique({
      where: { userId: user.id },
    })

    if (!integration) {
      return {
        success: false,
        error: 'Email integration not configured',
      }
    }

    // Calculate nextSyncAt if auto-sync is enabled
    let nextSyncAt: Date | null = null
    if (autoSyncEnabled) {
      nextSyncAt = new Date()
      nextSyncAt.setMinutes(nextSyncAt.getMinutes() + autoSyncFrequency)
    }

    await prisma.emailIntegration.update({
      where: { userId: user.id },
      data: {
        autoSyncEnabled,
        autoSyncFrequency,
        nextSyncAt,
      },
    })

    revalidateTag(cacheTagsFor(user.id).email, { expire: 0 })
    revalidatePath('/settings/integrations')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update auto-sync settings',
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
