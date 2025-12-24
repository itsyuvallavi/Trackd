'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createJobSchema, updateJobSchema } from '@/lib/validations/job'
import { JobStatus, ActivityType } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'

export async function createJob(formData: FormData) {
  const user = await requireAuth()
  const rawData = {
    title: formData.get('title') as string,
    company: formData.get('company') as string,
    url: formData.get('url') as string,
    location: formData.get('location') as string,
    source: formData.get('source') as string || 'MANUAL',
    status: formData.get('status') as string || 'SAVED',
    priority: formData.get('priority') as string || 'B',
    notes: formData.get('notes') as string,
    salary: formData.get('salary') as string,
    contactName: formData.get('contactName') as string,
    contactEmail: formData.get('contactEmail') as string,
    nextAction: formData.get('nextAction') as string,
  }

  const validated = createJobSchema.parse(rawData)

  const job = await prisma.job.create({
    data: {
      ...validated,
      userId: user.id,
      url: validated.url || null,
      location: validated.location || null,
      notes: validated.notes || null,
      salary: validated.salary || null,
      contactName: validated.contactName || null,
      contactEmail: validated.contactEmail || null,
      nextAction: validated.nextAction || null,
      appliedAt: validated.status === 'APPLIED' ? new Date() : null,
    },
  })

  await prisma.activity.create({
    data: {
      jobId: job.id,
      userId: user.id,
      type: 'NOTE',
      description: `Job "${job.title}" at ${job.company} created`,
    },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${job.id}`)
  return { success: true, jobId: job.id }
}

export async function updateJob(id: string, formData: FormData) {
  const user = await requireAuth()
  const rawData = {
    title: formData.get('title') as string,
    company: formData.get('company') as string,
    url: formData.get('url') as string,
    location: formData.get('location') as string,
    source: formData.get('source') as string,
    priority: formData.get('priority') as string,
    notes: formData.get('notes') as string,
    salary: formData.get('salary') as string,
    contactName: formData.get('contactName') as string,
    contactEmail: formData.get('contactEmail') as string,
    nextAction: formData.get('nextAction') as string,
  }

  const validated = updateJobSchema.parse(rawData)

  // Ensure the job belongs to the current user
  const existing = await prisma.job.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    throw new Error('Job not found')
  }

  const job = await prisma.job.update({
    where: { id },
    data: {
      ...validated,
      url: validated.url || null,
      location: validated.location || null,
      notes: validated.notes || null,
      salary: validated.salary || null,
      contactName: validated.contactName || null,
      contactEmail: validated.contactEmail || null,
      nextAction: validated.nextAction || null,
    },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  return { success: true, job }
}

export async function updateJobStatus(id: string, status: JobStatus) {
  const user = await requireAuth()
  const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
  if (!job) throw new Error('Job not found')

  const previousStatus = job.status

  // Update dates based on status changes
  let appliedAt = job.appliedAt
  let interviewAt = job.interviewAt

  if (status === 'APPLIED') {
    // Set appliedAt if not already set
    if (!appliedAt) {
      appliedAt = new Date()
    }
  }
  // Note: We keep appliedAt date even when status changes away from APPLIED for history

  if (status === 'INTERVIEW') {
    // Set interviewAt if not already set
    if (!interviewAt) {
      interviewAt = new Date()
    }
  } else {
    // Clear interviewAt when moving away from INTERVIEW status
    if (previousStatus === 'INTERVIEW') {
      interviewAt = null
    }
  }

  const updatedJob = await prisma.job.update({
    where: { id },
    data: {
      status,
      appliedAt,
      interviewAt,
    },
  })

  let activityType: ActivityType = 'STATUS_CHANGE'
  if (status === 'INTERVIEW') activityType = 'INTERVIEW'
  if (status === 'REJECTED') activityType = 'REJECTION'
  if (status === 'OFFER') activityType = 'OFFER'

  await prisma.activity.create({
    data: {
      jobId: id,
      userId: user.id,
      type: activityType,
      fromStatus: previousStatus,
      toStatus: status,
      description: `Status changed from ${previousStatus} to ${status}`,
    },
  })

  // Create notification for job update
  const notificationService = new NotificationService()
  await notificationService.createJobUpdatedNotification(
    user.id,
    id,
    job.title,
    job.company,
    previousStatus,
    status,
    'manual'
  )

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  return { success: true, job: updatedJob }
}

export async function deleteJob(id: string) {
  const user = await requireAuth()

  await prisma.job.deleteMany({
    where: { id, userId: user.id },
  })
  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  return { success: true }
}

export async function addActivity(jobId: string, description: string, type: ActivityType = 'NOTE') {
  const user = await requireAuth()
  const activity = await prisma.activity.create({
    data: {
      jobId,
      userId: user.id,
      type,
      description,
    },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  return { success: true, activity }
}

export async function updateJobNotes(jobId: string, notes: string) {
  const user = await requireAuth()
  
  // Ensure the job belongs to the current user
  const existing = await prisma.job.findFirst({ where: { id: jobId, userId: user.id } })
  if (!existing) {
    throw new Error('Job not found')
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      notes: notes.trim() || null,
    },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  return { success: true }
}
