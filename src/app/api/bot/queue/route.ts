import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { JobSource } from '@prisma/client'
import { jobSourceDisplayName } from '@/lib/job-source-display'
import { getPublicJobTableColumnNames } from '@/lib/prisma-job-columns'

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
  importSource: string | null
  importJobBoard: string | null
  tags: string[]
  botScore: number | null
  botReasoning: string | null
  coverLetter: string | null
  createdAt: Date
}

const DEFAULT_QUEUE_LIMIT = 50
const MAX_QUEUE_LIMIT = 100

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function isProfileComplete(
  p: {
    phone: string | null
    workAuthorization: string | null
    city: string | null
    applicationFullName: string | null
    applicationEmail: string | null
  } | null
): boolean {
  if (!p) return false
  return !!(
    p.phone &&
    p.workAuthorization &&
    p.city &&
    p.applicationFullName?.trim() &&
    p.applicationEmail?.trim()
  )
}

function normUrl(u: string | null | undefined): string | null {
  if (!u) return null
  return u.trim().replace(/\/$/, '') || null
}

function titleKey(company: string, title: string): string {
  return `${company.toLowerCase().trim()}::${title.toLowerCase().trim()}`
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { jobs: [], profileComplete: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const url = new URL(request.url)
  const limit = Math.min(
    MAX_QUEUE_LIMIT,
    Math.max(1, parsePositiveInt(url.searchParams.get('limit'), DEFAULT_QUEUE_LIMIT)),
  )
  const offset = parsePositiveInt(url.searchParams.get('offset'), 0)
  const take = limit + 1

  let appProfile: {
    phone: string | null
    workAuthorization: string | null
    city: string | null
    applicationFullName: string | null
    applicationEmail: string | null
  } | null = null
  try {
    appProfile = await prisma.applicationProfile.findUnique({
      where: { userId: user.id },
      select: {
        phone: true,
        workAuthorization: true,
        city: true,
        applicationFullName: true,
        applicationEmail: true,
      },
    })
  } catch (e) {
    console.error('[bot/queue] applicationProfile:', e)
  }

  const baseWhere = {
    userId: user.id,
    status: 'SAVED' as const,
    tags: { has: 'bot-approved' as const },
  }

  const cols = await getPublicJobTableColumnNames()
  const rawJobs = await prisma.job.findMany({
    where: baseWhere,
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      url: true,
      salary: true,
      source: true,
      ...(cols.has('importSource') ? { importSource: true as const } : {}),
      ...(cols.has('importJobBoard') ? { importJobBoard: true as const } : {}),
      botScore: true,
      botReasoning: true,
      coverLetter: true,
      tags: true,
      createdAt: true,
    },
    orderBy: [{ botScore: 'desc' }, { createdAt: 'desc' }],
    take,
    skip: offset,
  })

  const hasMore = rawJobs.length > limit
  const rawPage = hasMore ? rawJobs.slice(0, limit) : rawJobs

  const jobs: QueueJobRow[] = rawPage.map((j) => ({
    ...j,
    importSource: cols.has('importSource')
      ? ((j as { importSource?: string | null }).importSource ?? null)
      : null,
    importJobBoard: cols.has('importJobBoard')
      ? ((j as { importJobBoard?: string | null }).importJobBoard ?? null)
      : null,
  }))

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
    pagination: {
      limit,
      offset,
      nextOffset: hasMore ? offset + limit : null,
    },
    jobs: deduped.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
      duplicate: duplicateFlags[j.id] ?? null,
      sourceDisplayName: jobSourceDisplayName(j.importSource, j.source, j.importJobBoard, {
        tags: j.tags ?? [],
      }),
    })),
  })
}
