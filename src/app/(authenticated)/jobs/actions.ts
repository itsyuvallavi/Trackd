'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { TEMP_USER_ID } from '@/lib/constants'
import { createJobSchema, updateJobSchema } from '@/lib/validations/job'
import { JobStatus, ActivityType } from '@prisma/client'

export async function createJob(formData: FormData) {
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
      userId: TEMP_USER_ID,
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
      userId: TEMP_USER_ID,
      type: 'NOTE',
      description: `Job "${job.title}" at ${job.company} created`,
    },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${job.id}`)
  return { success: true, jobId: job.id }
}

export async function updateJob(id: string, formData: FormData) {
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
  const job = await prisma.job.findUnique({ where: { id } })
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
      userId: TEMP_USER_ID,
      type: activityType,
      fromStatus: previousStatus,
      toStatus: status,
      description: `Status changed from ${previousStatus} to ${status}`,
    },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  return { success: true, job: updatedJob }
}

export async function deleteJob(id: string) {
  await prisma.job.delete({ where: { id } })
  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  return { success: true }
}

export async function addActivity(jobId: string, description: string, type: ActivityType = 'NOTE') {
  const activity = await prisma.activity.create({
    data: {
      jobId,
      userId: TEMP_USER_ID,
      type,
      description,
    },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  return { success: true, activity }
}
