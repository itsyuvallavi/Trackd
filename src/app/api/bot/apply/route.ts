import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const user = await requireAuth()

  const { jobId } = await req.json() as { jobId: string }
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: user.id },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Duplicate guard: check if already applied by URL
  if (job.url) {
    const existing = await prisma.job.findFirst({
      where: {
        userId: user.id,
        url: job.url,
        status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] },
        id: { not: jobId },
      },
      select: { id: true, title: true, company: true, updatedAt: true },
    })
    if (existing) {
      return NextResponse.json(
        {
          error: 'duplicate',
          message: `You already applied to ${existing.company} – ${existing.title} on ${existing.updatedAt.toLocaleDateString()}.`,
          existingId: existing.id,
        },
        { status: 409 }
      )
    }
  }

  // Duplicate guard: check by company + title
  const existingByTitle = await prisma.job.findFirst({
    where: {
      userId: user.id,
      company: { equals: job.company, mode: 'insensitive' },
      title: { equals: job.title, mode: 'insensitive' },
      status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] },
      id: { not: jobId },
    },
    select: { id: true, title: true, company: true, updatedAt: true },
  })
  if (existingByTitle) {
    return NextResponse.json(
      {
        error: 'duplicate',
        message: `You already applied to ${existingByTitle.company} – ${existingByTitle.title} on ${existingByTitle.updatedAt.toLocaleDateString()}.`,
        existingId: existingByTitle.id,
      },
      { status: 409 }
    )
  }

  // Mark as applied
  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'APPLIED',
      appliedAt: new Date(),
      tags: { set: job.tags.filter((t) => t !== 'bot-approved').concat('bot-applied') },
      activities: {
        create: {
          userId: user.id,
          type: 'STATUS_CHANGE',
          fromStatus: 'SAVED',
          toStatus: 'APPLIED',
          description: 'Marked as applied from Bot Queue',
        },
      },
    },
    select: { id: true, status: true },
  })

  return NextResponse.json({ success: true, job: updated })
}
