import { prisma } from '@/lib/prisma'
import { JobStatus, ActivityType } from '@prisma/client'

interface ArchiveResult {
  jobsArchived: number
  jobIds: string[]
  errors: string[]
}

/** Pipeline statuses eligible for staleness-based auto-archive */
const ARCHIVABLE_STATUSES: JobStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW']

/**
 * Archives jobs that have not been updated (Job.updatedAt) in the given number of days.
 * No email activity or other minimum—only time since last update on the application row.
 */
export async function archiveInactiveJobs(
  userId: string,
  daysSinceUpdate: number = 21
): Promise<ArchiveResult> {
  const result: ArchiveResult = {
    jobsArchived: 0,
    jobIds: [],
    errors: [],
  }

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysSinceUpdate)

    const jobsToArchive = await prisma.job.findMany({
      where: {
        userId,
        status: { in: ARCHIVABLE_STATUSES },
        updatedAt: { lt: cutoff },
      },
    })

    for (const job of jobsToArchive) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.job.update({
            where: { id: job.id },
            data: {
              status: 'ARCHIVED' as JobStatus,
            },
          })

          await tx.activity.create({
            data: {
              jobId: job.id,
              userId,
              type: 'STATUS_CHANGE' as ActivityType,
              fromStatus: job.status,
              toStatus: 'ARCHIVED' as JobStatus,
              description: `Auto-archived: No updates for ${daysSinceUpdate}+ days`,
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
 * Archives stale jobs for all users that have jobs.
 */
export async function archiveInactiveJobsForAllUsers(daysSinceUpdate: number = 21): Promise<{
  totalUsersProcessed: number
  totalJobsArchived: number
  resultsByUser: Record<string, ArchiveResult>
}> {
  const usersWithJobs = await prisma.job.findMany({
    select: {
      userId: true,
    },
    distinct: ['userId'],
  })

  const uniqueUserIds = [...new Set(usersWithJobs.map((job) => job.userId))]

  const resultsByUser: Record<string, ArchiveResult> = {}
  let totalJobsArchived = 0

  for (const userId of uniqueUserIds) {
    const result = await archiveInactiveJobs(userId, daysSinceUpdate)
    resultsByUser[userId] = result
    totalJobsArchived += result.jobsArchived
  }

  return {
    totalUsersProcessed: uniqueUserIds.length,
    totalJobsArchived,
    resultsByUser,
  }
}
