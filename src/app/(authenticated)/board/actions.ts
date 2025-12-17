'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { TEMP_USER_ID } from '@/lib/constants'
import { JobStatus, ActivityType } from '@prisma/client'

export async function updateJobStatusOnBoard(jobId: string, newStatus: JobStatus) {
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Job not found')

  const previousStatus = job.status as JobStatus

  // Update dates based on status changes
  let appliedAt = job.appliedAt
  let interviewAt = job.interviewAt

  if (newStatus === 'APPLIED') {
    // Set appliedAt if not already set
    if (!appliedAt) {
      appliedAt = new Date()
    }
  }

  if (newStatus === 'INTERVIEW') {
    // Set interviewAt if not already set
    if (!interviewAt) {
      interviewAt = new Date()
    }
  }

  if (previousStatus === 'INTERVIEW' && newStatus !== 'INTERVIEW') {
    // Clear interviewAt when moving away from INTERVIEW status
    interviewAt = null
  }

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      appliedAt,
      interviewAt,
    },
  })

  // Create activity if status changed
  if (previousStatus !== newStatus) {
    let activityType: ActivityType = 'STATUS_CHANGE'
    if (newStatus === 'INTERVIEW') activityType = 'INTERVIEW'
    if (newStatus === 'REJECTED') activityType = 'REJECTION'
    if (newStatus === 'OFFER') activityType = 'OFFER'

    await prisma.activity.create({
      data: {
        jobId,
        userId: TEMP_USER_ID,
        type: activityType,
        fromStatus: previousStatus,
        toStatus: newStatus,
        description: `Status changed from ${previousStatus} to ${newStatus}`,
      },
    })
  }

  revalidatePath('/board')
  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  
  return { success: true, job: updatedJob }
}

