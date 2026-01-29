import { prisma } from '@/lib/prisma'
import { JobStatus, ActivityType } from '@prisma/client'

interface ArchiveResult {
  jobsArchived: number
  jobIds: string[]
  errors: string[]
}

/**
 * Archives jobs that haven't received email updates in the specified number of days
 * 
 * @param userId - User ID to process jobs for
 * @param daysSinceLastEmail - Number of days since last email activity (default: 30)
 * @param excludeRecentDays - Don't archive if manually updated in last N days (default: 7)
 * @returns Result with count of archived jobs and any errors
 */
export async function archiveInactiveJobs(
  userId: string,
  daysSinceLastEmail: number = 30,
  excludeRecentDays: number = 7
): Promise<ArchiveResult> {
  const result: ArchiveResult = {
    jobsArchived: 0,
    jobIds: [],
    errors: [],
  }

  try {
    // Calculate cutoff dates
    const emailCutoffDate = new Date()
    emailCutoffDate.setDate(emailCutoffDate.getDate() - daysSinceLastEmail)

    const manualUpdateCutoffDate = new Date()
    manualUpdateCutoffDate.setDate(manualUpdateCutoffDate.getDate() - excludeRecentDays)

    const jobAgeCutoffDate = new Date()
    jobAgeCutoffDate.setDate(jobAgeCutoffDate.getDate() - daysSinceLastEmail)

    // Find all jobs for this user that are candidates for archiving
    // Status must be: APPLIED, INTERVIEW, or SAVED (not OFFER, REJECTED, or ARCHIVED)
    // Must be older than the cutoff date (savedAt check)
    const candidateJobs = await prisma.job.findMany({
      where: {
        userId,
        status: {
          in: ['APPLIED', 'INTERVIEW', 'SAVED'] as JobStatus[],
        },
        // Not manually updated in recent days
        updatedAt: {
          lt: manualUpdateCutoffDate,
        },
        // Job must be older than the cutoff date
        savedAt: {
          lt: jobAgeCutoffDate,
        },
      },
      include: {
        activities: {
          where: {
            type: 'EMAIL_UPDATE',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Only need the most recent email activity
        },
      },
    })

    // Filter jobs that should be archived
    const jobsToArchive = candidateJobs.filter((job) => {
      // Case 1: Job has email activities - archive if last email was 30+ days ago
      if (job.activities.length > 0) {
        const lastEmailActivity = job.activities[0]
        return lastEmailActivity.createdAt < emailCutoffDate
      }

      // Case 2: Job has no email activities - archive if job was created/saved 30+ days ago
      // Use savedAt as the reference point (when job was first added)
      const jobAgeCutoffDate = new Date()
      jobAgeCutoffDate.setDate(jobAgeCutoffDate.getDate() - daysSinceLastEmail)
      
      return job.savedAt < jobAgeCutoffDate
    })

    // Archive each job
    for (const job of jobsToArchive) {
      try {
        // Use transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          // Update job status
          await tx.job.update({
            where: { id: job.id },
            data: {
              status: 'ARCHIVED' as JobStatus,
            },
          })

          // Create activity record
          await tx.activity.create({
            data: {
              jobId: job.id,
              userId,
              type: 'STATUS_CHANGE' as ActivityType,
              fromStatus: job.status,
              toStatus: 'ARCHIVED' as JobStatus,
              description: job.activities.length > 0
                ? `Auto-archived: No email activity for ${daysSinceLastEmail}+ days`
                : `Auto-archived: Job inactive for ${daysSinceLastEmail}+ days`,
            },
          })
        })

        result.jobsArchived++
        result.jobIds.push(job.id)
      } catch (error) {
        const errorMessage = `Failed to archive job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMessage)
        console.error(errorMessage, error)
      }
    }

    return result
  } catch (error) {
    const errorMessage = `Error in archiveInactiveJobs: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMessage)
    console.error(errorMessage, error)
    return result
  }
}

/**
 * Archives inactive jobs for all users
 * 
 * @param daysSinceLastEmail - Number of days since last email activity (default: 30)
 * @param excludeRecentDays - Don't archive if manually updated in last N days (default: 7)
 * @returns Summary of results across all users
 */
export async function archiveInactiveJobsForAllUsers(
  daysSinceLastEmail: number = 30,
  excludeRecentDays: number = 7
): Promise<{
  totalUsersProcessed: number
  totalJobsArchived: number
  resultsByUser: Record<string, ArchiveResult>
}> {
  // Get all unique user IDs from jobs table (users who have jobs)
  // This ensures we only process users who actually have jobs to potentially archive
  const usersWithJobs = await prisma.job.findMany({
    select: {
      userId: true,
    },
    distinct: ['userId'],
  })

  const userIds = usersWithJobs.map((job) => job.userId)
  
  // Remove duplicates (though distinct should handle this)
  const uniqueUserIds = [...new Set(userIds)]

  const resultsByUser: Record<string, ArchiveResult> = {}
  let totalJobsArchived = 0

  for (const userId of uniqueUserIds) {
    const result = await archiveInactiveJobs(
      userId,
      daysSinceLastEmail,
      excludeRecentDays
    )
    resultsByUser[userId] = result
    totalJobsArchived += result.jobsArchived
  }

  return {
    totalUsersProcessed: uniqueUserIds.length,
    totalJobsArchived,
    resultsByUser,
  }
}
