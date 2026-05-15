import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import type { SyncCompleteJobChange } from '@/lib/notification-service'

/**
 * Returns per-job sync updates for a SYNC_COMPLETE notification.
 * Uses embedded metadata.jobChanges when present; otherwise reconstructs from Activity rows
 * created during the same sync window (for notifications from before jobChanges was stored).
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id, type: 'SYNC_COMPLETE' },
    })
    if (!notification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const raw = notification.metadata
    const meta =
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const stats = meta.stats as { updatedJobs?: number } | undefined
    const embedded = meta.jobChanges as SyncCompleteJobChange[] | undefined

    if (Array.isArray(embedded) && embedded.length > 0) {
      return NextResponse.json({ jobChanges: embedded, source: 'metadata' as const })
    }

    const updatedJobs = stats?.updatedJobs ?? 0
    if (updatedJobs === 0) {
      return NextResponse.json({ jobChanges: [], source: 'none' as const })
    }

    const notificationCreatedAt = notification.createdAt
    const windowStart = new Date(notificationCreatedAt.getTime() - 12 * 60 * 1000)

    const activities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: windowStart,
          lte: notificationCreatedAt,
        },
        description: { startsWith: 'Email detected:' },
      },
      include: {
        job: { select: { id: true, title: true, company: true, interviewAt: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(updatedJobs + 40, 100),
    })

    const fromEmailSync = activities.filter((a) => {
      const m = a.metadata
      return (
        m !== null &&
        typeof m === 'object' &&
        'emailSubject' in (m as Record<string, unknown>)
      )
    })

    const slice = fromEmailSync.slice(-updatedJobs)

    const jobChanges: SyncCompleteJobChange[] = slice.map((a) => {
      const m = (a.metadata ?? {}) as { emailSubject?: string }
      return {
        jobId: a.jobId,
        title: a.job.title,
        company: a.job.company,
        oldStatus: a.fromStatus,
        newStatus: a.toStatus!,
        emailSubject: m.emailSubject,
        interviewAtIso: a.job.interviewAt?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ jobChanges, source: 'activity_fallback' as const })
  } catch (error) {
    console.error('[sync-job-changes]', error)
    return NextResponse.json(
      { error: 'Failed to load sync updates' },
      { status: 500 }
    )
  }
}
