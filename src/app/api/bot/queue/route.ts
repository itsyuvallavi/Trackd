import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function isProfileComplete(
  p: { phone: string | null; workAuthorization: string | null; city: string | null } | null
): boolean {
  if (!p) return false
  return !!(p.phone && p.workAuthorization && p.city)
}

export async function GET() {
  const user = await requireAuth()

  const [appProfile, jobs] = await Promise.all([
    prisma.applicationProfile.findUnique({
      where: { userId: user.id },
      select: { phone: true, workAuthorization: true, city: true },
    }),
    prisma.job.findMany({
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
    }),
  ])

  // De-duplicate within the queue: keep only the highest-scoring entry per company+title
  const seenTitleKeys = new Map<string, string>()
  const deduped = jobs.filter((job) => {
    const key = `${job.company.toLowerCase().trim()}::${job.title.toLowerCase().trim()}`
    if (seenTitleKeys.has(key)) return false
    seenTitleKeys.set(key, job.id)
    return true
  })

  // Check for jobs the user already applied to
  const duplicateFlags: Record<string, { appliedAt: Date; existingId: string }> = {}

  for (const job of deduped) {
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
    profileComplete: isProfileComplete(appProfile),
    jobs: deduped.map((j) => ({
      ...j,
      duplicate: duplicateFlags[j.id] ?? null,
    })),
  })
}
