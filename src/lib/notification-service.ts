import { prisma } from '@/lib/prisma'
import { NotificationType, JobStatus } from '@prisma/client'
import { EmailMessage } from './email-service'
import { ClassifiedEmail } from './email-classifier'

export interface SyncStats {
  totalEmails: number
  processedEmails: number
  createdJobs: number
  updatedJobs: number
  skippedEmails: number
  ambiguousMatches: number
  newJobsDetected: number
  noMatches: number
}

export class NotificationService {
  /**
   * Create notification for ambiguous match (email could match multiple jobs)
   */
  async createAmbiguousMatchNotification(
    userId: string,
    email: EmailMessage,
    matchedJobs: Array<{ id: string; title: string; company: string }>,
    classified: ClassifiedEmail
  ): Promise<string> {
    const jobList = matchedJobs
      .map((job, idx) => `${idx + 1}. ${job.title} at ${job.company}`)
      .join('\n')

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'AMBIGUOUS_MATCH',
        title: 'Ambiguous Match',
        message: `Email from ${email.from} could match multiple jobs:\n\n${jobList}`,
        metadata: {
          emailSubject: email.subject,
          emailFrom: email.from,
          emailDate: email.date.toISOString(),
          matchedJobs: matchedJobs.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company,
          })),
          suggestedStatus: classified.suggestedStatus,
          emailType: classified.type,
          emailTextBody: email.textBody.substring(0, 2000), // Store first 2000 chars for context
        },
        actionUrl: '', // Will be updated below
      },
    })

    // Update with notificationId in actionUrl
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        actionUrl: `/notifications/ambiguous?notificationId=${notification.id}`,
      },
    })

    return notification.id
  }

  /**
   * Create notification for new job detected (company + title not in list)
   */
  async createNewJobDetectedNotification(
    userId: string,
    email: EmailMessage,
    classified: ClassifiedEmail,
    jobInfo: { company: string; title: string; location?: string }
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: 'NEW_JOB_DETECTED',
        title: 'New Job Detected',
        message: `"${jobInfo.title}" at ${jobInfo.company}\nFound in email from ${email.from}`,
        metadata: {
          emailSubject: email.subject,
          emailFrom: email.from,
          emailDate: email.date.toISOString(),
          company: jobInfo.company,
          title: jobInfo.title,
          location: jobInfo.location,
          suggestedStatus: classified.suggestedStatus,
          emailType: classified.type,
          emailTextBody: email.textBody.substring(0, 500), // Store first 500 chars for context
        },
        actionUrl: `/notifications/new-job?emailSubject=${encodeURIComponent(email.subject)}`,
      },
    })
  }

  /**
   * Create notification when job is updated (manual or automatic)
   */
  async createJobUpdatedNotification(
    userId: string,
    jobId: string,
    jobTitle: string,
    company: string,
    oldStatus: JobStatus | null,
    newStatus: JobStatus,
    source: 'email' | 'manual'
  ): Promise<void> {
    const statusChange = oldStatus
      ? `${oldStatus} → ${newStatus}`
      : `Status set to ${newStatus}`

    await prisma.notification.create({
      data: {
        userId,
        type: 'JOB_UPDATED',
        title: 'Job Updated',
        message: `"${jobTitle}" at ${company}\nStatus changed: ${statusChange}`,
        metadata: {
          jobId,
          jobTitle,
          company,
          oldStatus,
          newStatus,
          source,
        },
        actionUrl: `/jobs/${jobId}`,
      },
    })
  }

  /**
   * Create notification when sync completes
   */
  async createSyncCompleteNotification(
    userId: string,
    stats: SyncStats
  ): Promise<void> {
    const parts: string[] = []
    if (stats.updatedJobs > 0) {
      parts.push(`• ${stats.updatedJobs} job${stats.updatedJobs > 1 ? 's' : ''} updated`)
    }
    if (stats.newJobsDetected > 0) {
      parts.push(`• ${stats.newJobsDetected} new job${stats.newJobsDetected > 1 ? 's' : ''} detected`)
    }
    if (stats.ambiguousMatches > 0) {
      parts.push(`• ${stats.ambiguousMatches} ambiguous match${stats.ambiguousMatches > 1 ? 'es' : ''}`)
    }
    if (stats.noMatches > 0) {
      parts.push(`• ${stats.noMatches} unmatched email${stats.noMatches > 1 ? 's' : ''}`)
    }

    const message = parts.length > 0
      ? `Processed ${stats.processedEmails} email${stats.processedEmails > 1 ? 's' : ''}\n\n${parts.join('\n')}`
      : `Processed ${stats.processedEmails} email${stats.processedEmails > 1 ? 's' : ''}. No updates.`

    await prisma.notification.create({
      data: {
        userId,
        type: 'SYNC_COMPLETE',
        title: 'Sync Complete',
        message,
        metadata: JSON.parse(JSON.stringify({ stats })),
        actionUrl: '/jobs',
      },
    })
  }

  /**
   * Create notification for sync errors
   */
  async createSyncErrorNotification(
    userId: string,
    error: string
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYNC_ERROR',
        title: 'Sync Error',
        message: `Email sync failed: ${error}`,
        metadata: {
          error,
        },
        actionUrl: '/settings/integrations',
      },
    })
  }

  /**
   * Create notification when email can't be matched and has insufficient info
   */
  async createNoMatchNotification(
    userId: string,
    email: EmailMessage,
    classified: ClassifiedEmail
  ): Promise<string> {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'NEW_JOB_DETECTED', // Use same type but with different metadata
        title: 'New Email Detected',
        message: `Email from ${email.from} about ${classified.jobInfo?.company || 'unknown company'}\nCouldn't match to existing job (insufficient information)`,
        metadata: {
          emailSubject: email.subject,
          emailFrom: email.from,
          emailDate: email.date.toISOString(),
          company: classified.jobInfo?.company,
          title: classified.jobInfo?.title,
          hasInsufficientInfo: true,
          emailTextBody: email.textBody.substring(0, 2000), // Store first 2000 chars for context
        },
        actionUrl: '', // Will be updated below
      },
    })

    // Update with notificationId in actionUrl
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        actionUrl: `/notifications/no-match?notificationId=${notification.id}`,
      },
    })

    return notification.id
  }

  /**
   * Get unread notifications count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
      data: {
        isRead: true,
      },
    })
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
    })
  }
}
