import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isProfileComplete(
  p: { phone: string | null; workAuthorization: string | null; city: string | null } | null
): boolean {
  if (!p) return false
  return !!(p.phone && p.workAuthorization && p.city)
}

export async function GET() {
  // Do NOT use requireAuth() here — it calls redirect() which throws and must not be
  // caught by a broad try/catch (would turn auth failures into 500s).
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { jobs: [], profileComplete: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  let appProfile: { phone: string | null; workAuthorization: string | null; city: string | null } | null =
    null
  try {
    appProfile = await prisma.applicationProfile.findUnique({
      where: { userId: user.id },
      select: { phone: true, workAuthorization: true, city: true },
    })
  } catch (e) {
    console.error('[bot/queue] applicationProfile:', e)
    // Table missing or DB issue — still return queue jobs
  }

  let jobs: {
    id: string
    title: string
    company: string
    location: string | null
    url: string | null
    salary: string | null
    source: import('@prisma/client').JobSource
    botScore: number | null
    botReasoning: string | null
    coverLetter: string | null
    createdAt: Date
  }[]
  try {
    jobs = await prisma.job.findMany({
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
  } catch (e) {
    console.error('[bot/queue] jobs query:', e)
    return NextResponse.json(
      { jobs: [], profileComplete: isProfileComplete(appProfile), error: 'Database error' },
      { status: 500 }
    )
  }

  const seenTitleKeys = new Map<string, string>()
  const deduped = jobs.filter((job) => {
    const key = `${job.company.toLowerCase().trim()}::${job.title.toLowerCase().trim()}`
    if (seenTitleKeys.has(key)) return false
    seenTitleKeys.set(key, job.id)
    return true
  })

  const duplicateFlags: Record<string, { appliedAt: Date; existingId: string }> = {}

  try {
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
  } catch (e) {
    console.error('[bot/queue] duplicate check:', e)
    // Return jobs without duplicate flags
  }

  return NextResponse.json({
    profileComplete: isProfileComplete(appProfile),
    jobs: deduped.map((j) => ({
      ...j,
      duplicate: duplicateFlags[j.id] ?? null,
    })),
  })
}
