'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createEmailService } from '@/lib/email-service'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import { ActivityType, JobStatus } from '@prisma/client'
import { requireAuth } from '@/lib/auth'

/**
 * Sync emails and update jobs based on email content
 * Always uses incremental sync (since lastSyncedAt) to avoid double-scanning
 */
export async function syncEmails() {
  let userId: string | null = null

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

    // Get all user's jobs for matching
    console.log('Fetching jobs from database...')
    const jobs = await prisma.job.findMany({
      where: { userId },
      select: { id: true, title: true, company: true, url: true, status: true },
    })
    console.log(`✓ Found ${jobs.length} jobs to match against`)
    
    if (jobs.length === 0) {
      console.log('⚠️  No jobs found - emails will be classified but not matched')
    }

    // Classify and process each email
    console.log('Starting email classification...')
    const classifier = new EmailClassifier()
    let updatedCount = 0
    let createdCount = 0
    let processedCount = 0
    let skippedCount = 0
    let skippedOtherCount = 0
    let skippedLowConfidenceCount = 0

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

        // Try to match email to existing job
        const matchedJobId = classifier.matchToJob(classified, jobs)

        if (matchedJobId && classified.suggestedStatus) {
          const job = jobs.find((j) => j.id === matchedJobId)

          // Only update if it's a status advancement (don't go backwards)
          const shouldUpdate = shouldUpdateStatus(job?.status, classified.suggestedStatus)

          if (shouldUpdate) {
            // Update job status
            await prisma.job.update({
              where: { id: matchedJobId },
              data: { status: classified.suggestedStatus },
            })

            // Create activity record
            await prisma.activity.create({
              data: {
                jobId: matchedJobId,
                userId,
                type: getActivityType(classified.type),
                fromStatus: job?.status,
                toStatus: classified.suggestedStatus,
                description: `Email detected: ${email.subject}`,
              },
            })

            updatedCount++
            console.log(`Updated job ${matchedJobId} to status ${classified.suggestedStatus}`)
          } else {
            console.log(`Skipped updating job ${matchedJobId} - status would go backwards`)
          }
        } else if (classified.jobInfo?.company) {
          // Create a new job from the email if we have company info
          // Only create if we have at least a company name
          const jobTitle = classified.jobInfo.title || 'Unknown Position'
          const companyName = classified.jobInfo.company

          // Check if we already have a job with this company (to avoid duplicates)
          const existingJob = jobs.find(
            (j) => j.company.toLowerCase() === companyName.toLowerCase()
          )

          if (!existingJob) {
            // Create new job
            const newJob = await prisma.job.create({
              data: {
                userId,
                title: jobTitle,
                company: companyName,
                location: classified.jobInfo.location || null,
                status: classified.suggestedStatus || JobStatus.APPLIED,
                source: 'RECRUITER',
                appliedAt: classified.suggestedStatus === JobStatus.APPLIED ? email.date : null,
                contactEmail: email.from,
              },
            })

            // Create activity record
            await prisma.activity.create({
              data: {
                jobId: newJob.id,
                userId,
                type: getActivityType(classified.type),
                toStatus: classified.suggestedStatus || JobStatus.APPLIED,
                description: `Job created from email: ${email.subject}`,
              },
            })

            createdCount++
            console.log(`Created new job: ${jobTitle} at ${companyName} (status: ${classified.suggestedStatus || JobStatus.APPLIED})`)
            
            // Add to jobs array for future matching in this sync
            jobs.push({
              id: newJob.id,
              title: newJob.title,
              company: newJob.company,
              url: newJob.url,
              status: newJob.status,
            })
          } else {
            console.log(`Skipped creating job for "${companyName}" - job already exists`)
          }
        } else {
          console.log(`Could not match email "${email.subject}" to any job and no company info extracted`)
        }
      } catch (error) {
        console.error(`Error processing email "${email.subject}":`, error)
        // Continue processing other emails
      }
    }

    console.log(`Sync complete: ${processedCount} processed, ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`)
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
    revalidatePath('/jobs')
    revalidatePath('/today')
    revalidatePath('/board')
    console.log('✓ Paths revalidated')

    const result = {
      success: true,
      stats: {
        totalEmails: emails.length,
        processedEmails: processedCount,
        createdJobs: createdCount,
        updatedJobs: updatedCount,
        skippedEmails: skippedCount,
        skippedOther: skippedOtherCount,
        skippedLowConfidence: skippedLowConfidenceCount,
        syncSince: syncSince.toISOString(),
      },
    }
    console.log('Returning result:', result)
    return result
  } catch (error) {
    console.error('Email sync error:', error)

    // Log error to database
    if (userId) {
      try {
        await prisma.emailIntegration.update({
          where: { userId },
          data: {
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
        })
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
