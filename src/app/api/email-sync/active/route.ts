import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SyncProgressDetails = {
  state?: string
  reviewedEmails?: number
  totalEmails?: number
  jobsCount?: number
}

function detailsObject(value: unknown): SyncProgressDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as SyncProgressDetails
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const log = await prisma.emailSyncLog.findFirst({
    where: {
      userId: user.id,
      startedAt: { gte: since },
      OR: [
        { completedAt: null },
        {
          completedAt: {
            gte: new Date(Date.now() - 30_000),
          },
        },
      ],
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      duration: true,
      source: true,
      totalEmails: true,
      processedEmails: true,
      skippedEmails: true,
      exactMatches: true,
      fuzzyMatches: true,
      ambiguousMatches: true,
      newJobsDetected: true,
      noMatches: true,
      jobsUpdated: true,
      notificationsCreated: true,
      success: true,
      errorMessage: true,
      details: true,
    },
  })

  if (!log) {
    return NextResponse.json({ sync: null })
  }

  const details = detailsObject(log.details)
  return NextResponse.json({
    sync: {
      ...log,
      status: log.completedAt ? (log.success ? 'COMPLETED' : 'FAILED') : 'RUNNING',
      startedAt: log.startedAt.toISOString(),
      completedAt: log.completedAt?.toISOString() ?? null,
      progressState: details.state ?? (log.completedAt ? 'completed' : 'fetching'),
      reviewedEmails: details.reviewedEmails ?? log.processedEmails + log.skippedEmails,
      totalEmails: details.totalEmails ?? log.totalEmails,
      jobsCount: details.jobsCount ?? null,
    },
  })
}
