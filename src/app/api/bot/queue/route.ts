import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { JobSource } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type QueueJobRow = {
  id: string
  title: string
  company: string
  location: string | null
  url: string | null
  salary: string | null
  source: JobSource
  botScore: number | null
  botReasoning: string | null
  coverLetter: string | null
  createdAt: Date
}

function isProfileComplete(
  p: { phone: string | null; workAuthorization: string | null; city: string | null } | null
): boolean {
  if (!p) return false
  return !!(p.phone && p.workAuthorization && p.city)
}

function normUrl(u: string | null | undefined): string | null {
  if (!u) return null
  return u.trim().replace(/\/$/, '') || null
}

function titleKey(company: string, title: string): string {
  return `${company.toLowerCase().trim()}::${title.toLowerCase().trim()}`
}

export async function GET() {
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
  }

  const baseWhere = {
    userId: user.id,
    status: 'SAVED' as const,
    tags: { has: 'bot-approved' as const },
  }

  let jobs: QueueJobRow[]

  try {
    jobs = await prisma.job.findMany({
      where: baseWhere,
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
    // Production DB may not have bot_* / coverLetter columns yet
    console.error('[bot/queue] jobs full select failed, minimal select:', e)
    try {
      const minimal = await prisma.job.findMany({
        where: baseWhere,
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          url: true,
          salary: true,
          source: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      jobs = minimal.map((j) => ({
        ...j,
        botScore: null,
        botReasoning: null,
        coverLetter: null,
      }))
    } catch (e2) {
      console.error('[bot/queue] jobs minimal select:', e2)
      return NextResponse.json(
        { jobs: [], profileComplete: isProfileComplete(appProfile), error: 'Database error' },
        { status: 500 }
      )
    }
  }

  const seen = new Map<string, string>()
  const deduped = jobs.filter((job) => {
    const key = titleKey(job.company, job.title)
    if (seen.has(key)) return false
    seen.set(key, job.id)
    return true
  })

  const duplicateFlags: Record<string, { appliedAt: Date; existingId: string }> = {}

  try {
    const applied = await prisma.job.findMany({
      where: {
        userId: user.id,
        status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] },
      },
      select: { id: true, url: true, company: true, title: true, updatedAt: true },
    })

    const byUrl = new Map<string, { id: string; updatedAt: Date }>()
    const byTitle = new Map<string, { id: string; updatedAt: Date }>()
    for (const j of applied) {
      const nu = normUrl(j.url)
      if (nu && !byUrl.has(nu)) byUrl.set(nu, { id: j.id, updatedAt: j.updatedAt })
      const tk = titleKey(j.company, j.title)
      if (!byTitle.has(tk)) byTitle.set(tk, { id: j.id, updatedAt: j.updatedAt })
    }

    for (const job of deduped) {
      const nu = normUrl(job.url)
      if (nu) {
        const hit = byUrl.get(nu)
        if (hit && hit.id !== job.id) {
          duplicateFlags[job.id] = { appliedAt: hit.updatedAt, existingId: hit.id }
          continue
        }
      }
      const hit = byTitle.get(titleKey(job.company, job.title))
      if (hit && hit.id !== job.id) {
        duplicateFlags[job.id] = { appliedAt: hit.updatedAt, existingId: hit.id }
      }
    }
  } catch (e) {
    console.error('[bot/queue] duplicate batch:', e)
  }

  return NextResponse.json({
    profileComplete: isProfileComplete(appProfile),
    jobs: deduped.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
      duplicate: duplicateFlags[j.id] ?? null,
    })),
  })
}
