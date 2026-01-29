'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ActivityType } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'

/**
 * Update interview date and time for a job
 */
export async function updateInterviewDate(jobId: string, interviewAt: Date | null) {
  const user = await requireAuth()

  // Verify job belongs to user
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      userId: user.id,
    },
  })

  if (!job) {
    throw new Error('Job not found')
  }

  const previousInterviewAt = job.interviewAt

  // Update the job
  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: {
      interviewAt,
      // If setting interview date and status is not INTERVIEW, update status
      ...(interviewAt && job.status !== 'INTERVIEW'
        ? { status: 'INTERVIEW' }
        : {}),
      // If removing interview date and status is INTERVIEW, revert to APPLIED
      ...(!interviewAt && job.status === 'INTERVIEW'
        ? { status: 'APPLIED' }
        : {}),
    },
  })

  // Create activity
  if (interviewAt) {
    await prisma.activity.create({
      data: {
        jobId,
        userId: user.id,
        type: 'INTERVIEW',
        description: previousInterviewAt
          ? `Interview rescheduled to ${interviewAt.toLocaleDateString()}`
          : `Interview scheduled for ${interviewAt.toLocaleDateString()}`,
        metadata: {
          interviewDate: interviewAt.toISOString(),
        },
      },
    })
  } else if (previousInterviewAt) {
    await prisma.activity.create({
      data: {
        jobId,
        userId: user.id,
        type: 'NOTE',
        description: 'Interview date removed',
      },
    })
  }

  // Create notification if interview was scheduled
  if (interviewAt) {
    const notificationService = new NotificationService()
    await notificationService.createJobUpdatedNotification(
      user.id,
      jobId,
      job.title,
      job.company,
      job.status,
      updatedJob.status,
      'manual'
    )
  }

  revalidatePath('/calendar')
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/jobs')

  return { success: true, job: updatedJob }
}

/**
 * Remove interview date from a job
 */
export async function removeInterview(jobId: string) {
  return updateInterviewDate(jobId, null)
}

