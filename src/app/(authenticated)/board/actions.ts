'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { JobStatus, ActivityType } from '@prisma/client'
import { cacheTagsFor } from '@/lib/cache-tags'

export async function updateJobStatusOnBoard(jobId: string, newStatus: JobStatus) {
  const user = await requireAuth()
  const job = await prisma.job.findFirst({ where: { id: jobId, userId: user.id } })
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
        userId: user.id,
        type: activityType,
        fromStatus: previousStatus,
        toStatus: newStatus,
        description: `Status changed from ${previousStatus} to ${newStatus}`,
      },
    })
  }

  const tags = cacheTagsFor(user.id)
  revalidateTag(tags.jobs, { expire: 0 })
  revalidateTag(tags.activity, { expire: 0 })

  revalidatePath('/board')
  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)

  return { success: true, job: updatedJob }
}

