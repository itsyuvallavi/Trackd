'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createEmailService } from '@/lib/email-service'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import { ActivityType, JobStatus } from '@prisma/client'

/**
 * Sync emails and update jobs based on email content
 */
export async function syncEmails() {
  try {
    const userId = 'temp-user' // TODO: Replace with actual user ID from auth

    // Get email integration settings
    const integration = await prisma.emailIntegration.findUnique({
      where: { userId },
    })

    if (!integration || !integration.isActive) {
      return { success: false, error: 'Email integration not configured' }
    }

    // Determine the date to sync from
    const syncSince = integration.lastSyncedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago if never synced

    // Fetch emails
    const emailService = createEmailService()
    const emails = await emailService.fetchEmailsSince(syncSince)

    console.log(`Fetched ${emails.length} emails since ${syncSince}`)

    // Get all user's jobs for matching
    const jobs = await prisma.job.findMany({
      where: { userId },
      select: { id: true, title: true, company: true, url: true, status: true },
    })

    // Classify and process each email
    const classifier = new EmailClassifier()
    let updatedCount = 0
    let processedCount = 0

    for (const email of emails) {
      const classified = classifier.classify(email)

      // Only process job-related emails
      if (classified.type === EmailType.OTHER || classified.confidence < 20) {
        continue
      }

      processedCount++

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
        }
      }
    }

    // Update last synced timestamp
    await prisma.emailIntegration.update({
      where: { userId },
      data: {
        lastSyncedAt: new Date(),
        lastError: null,
      },
    })

    revalidatePath('/jobs')
    revalidatePath('/today')
    revalidatePath('/board')

    return {
      success: true,
      stats: {
        totalEmails: emails.length,
        processedEmails: processedCount,
        updatedJobs: updatedCount,
      },
    }
  } catch (error) {
    console.error('Email sync error:', error)

    // Log error to database
    try {
      await prisma.emailIntegration.update({
        where: { userId: 'temp-user' },
        data: {
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      })
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
 * Save email integration settings
 */
export async function saveEmailIntegration(formData: FormData) {
  const userId = 'temp-user' // TODO: Replace with actual user ID from auth

  const email = formData.get('email') as string
  const imapHost = formData.get('imapHost') as string
  const imapPort = parseInt(formData.get('imapPort') as string)
  const imapUsername = formData.get('imapUsername') as string
  const imapPassword = formData.get('imapPassword') as string

  try {
    // Test connection first
    const emailService = createEmailService()
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
    const emailService = createEmailService()
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
