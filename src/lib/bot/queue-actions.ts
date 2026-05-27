import { prisma } from '@/lib/prisma'
import { dismissedRowsForUser } from '@/lib/bot/dismissed-job-imports'
import { revalidateTag } from 'next/cache'
import { cacheTagsFor } from '@/lib/cache-tags'

function invalidateBotQueueActionCaches(userId: string) {
  const tags = cacheTagsFor(userId)
  revalidateTag(tags.jobs, { expire: 0 })
  revalidateTag(tags.bot, { expire: 0 })
  revalidateTag(tags.activity, { expire: 0 })
}

function withoutTag(tags: string[], tag: string): string[] {
  return tags.filter((item) => item !== tag)
}

function withTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags : [...tags, tag]
}

function duplicateMessage(job: { company: string; title: string; updatedAt: Date }): string {
  return `You already applied to ${job.company} – ${job.title} on ${job.updatedAt.toLocaleDateString()}.`
}

export class BotQueueActionError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'duplicate',
    readonly status = code === 'duplicate' ? 409 : 404,
    readonly existingId?: string,
  ) {
    super(message)
    this.name = 'BotQueueActionError'
  }
}

export async function markBotQueueJobApplied(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
  })

  if (!job) {
    throw new BotQueueActionError('Job not found', 'not_found')
  }

  if (job.url) {
    const existing = await prisma.job.findFirst({
      where: {
        userId,
        url: job.url,
        status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] },
        id: { not: jobId },
      },
      select: { id: true, title: true, company: true, updatedAt: true },
    })
    if (existing) {
      throw new BotQueueActionError(
        duplicateMessage(existing),
        'duplicate',
        409,
        existing.id,
      )
    }
  }

  const existingByTitle = await prisma.job.findFirst({
    where: {
      userId,
      company: { equals: job.company, mode: 'insensitive' },
      title: { equals: job.title, mode: 'insensitive' },
      status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] },
      id: { not: jobId },
    },
    select: { id: true, title: true, company: true, updatedAt: true },
  })
  if (existingByTitle) {
    throw new BotQueueActionError(
      duplicateMessage(existingByTitle),
      'duplicate',
      409,
      existingByTitle.id,
    )
  }

  const tags = withTag(
    withoutTag(withoutTag(job.tags, 'bot-approved'), 'bot-skipped'),
    'bot-applied',
  )

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'APPLIED',
      appliedAt: new Date(),
      tags: { set: tags },
      activities: {
        create: {
          userId,
          type: 'STATUS_CHANGE',
          fromStatus: 'SAVED',
          toStatus: 'APPLIED',
          description: 'Marked as applied from Bot Queue',
        },
      },
    },
    select: { id: true, status: true },
  })
  invalidateBotQueueActionCaches(userId)
  return updated
}

export async function skipBotQueueJob(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true, tags: true },
  })

  if (!job) {
    throw new BotQueueActionError('Job not found', 'not_found')
  }

  const tags = withTag(withoutTag(job.tags, 'bot-approved'), 'bot-skipped')

  await prisma.job.update({
    where: { id: jobId },
    data: {
      tags: { set: tags },
      activities: {
        create: {
          userId,
          type: 'NOTE',
          description: 'Skipped from Bot Queue',
        },
      },
    },
  })
  invalidateBotQueueActionCaches(userId)
}

export async function deleteBotQueueJob(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      userId,
      tags: { has: 'bot-approved' },
    },
    select: { url: true, title: true, company: true },
  })

  if (!job) {
    throw new BotQueueActionError('Job not found or not in bot queue', 'not_found')
  }

  const rows = dismissedRowsForUser(userId, job)
  if (rows.length > 0) {
    await prisma.dismissedJobImport.createMany({ data: rows, skipDuplicates: true })
  }

  await prisma.job.deleteMany({
    where: {
      id: jobId,
      userId,
      tags: { has: 'bot-approved' },
    },
  })
  invalidateBotQueueActionCaches(userId)
}
