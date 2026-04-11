import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireAuth()

  const jobs = await prisma.job.findMany({
    where: {
      userId: user.id,
      status: 'SAVED',
      tags: { has: 'bot-approved' },
    },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      url: true,
      salary: true,
      source: true,
      botScore: true,
      botReasoning: true,
      coverLetter: true,
      createdAt: true,
    },
    orderBy: [{ botScore: 'desc' }, { createdAt: 'desc' }],
  })

  // Check for any duplicates the user may have already applied to elsewhere
  const duplicateFlags: Record<string, { appliedAt: Date; existingId: string }> = {}

  for (const job of jobs) {
    // Check by URL first (exact match)
    if (job.url) {
      const existing = await prisma.job.findFirst({
        where: {
          userId: user.id,
          url: job.url,
          status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] },
          id: { not: job.id },
        },
        select: { id: true, updatedAt: true },
      })
      if (existing) {
        duplicateFlags[job.id] = { appliedAt: existing.updatedAt, existingId: existing.id }
        continue
      }
    }

    // Check by company + title similarity
    const existing = await prisma.job.findFirst({
      where: {
        userId: user.id,
        company: { equals: job.company, mode: 'insensitive' },
        title: { equals: job.title, mode: 'insensitive' },
        status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] },
        id: { not: job.id },
      },
      select: { id: true, updatedAt: true },
    })
    if (existing) {
      duplicateFlags[job.id] = { appliedAt: existing.updatedAt, existingId: existing.id }
    }
  }

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      ...j,
      duplicate: duplicateFlags[j.id] ?? null,
    })),
  })
}
