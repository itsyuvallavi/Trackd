import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { AmbiguousMatchResolver } from '@/components/notifications/ambiguous-match-resolver'
import { notFound } from 'next/navigation'
import { serializeForClient } from '@/lib/serialize-for-client'

const AMBIGUOUS_FALLBACK_TAKE = 200

export default async function AmbiguousMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ emailSubject?: string; notificationId?: string }>
}) {
  const user = await requireAuth()
  const params = await searchParams
  const { emailSubject, notificationId } = params

  let notification = null
  if (notificationId) {
    notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
        type: 'AMBIGUOUS_MATCH',
      },
    })
  } else if (emailSubject) {
    notification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: 'AMBIGUOUS_MATCH',
        metadata: {
          path: ['emailSubject'],
          equals: emailSubject,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!notification) {
      const allNotifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
          type: 'AMBIGUOUS_MATCH',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: AMBIGUOUS_FALLBACK_TAKE,
      })

      notification =
        allNotifications.find((n) => {
          const meta = n.metadata as { emailSubject?: string } | null
          const decodedSubject = decodeURIComponent(emailSubject)
          return meta?.emailSubject === decodedSubject
        }) || null
    }
  } else {
    notification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: 'AMBIGUOUS_MATCH',
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  if (!notification) {
    notFound()
  }

  const metadata = notification.metadata as {
    emailSubject: string
    emailFrom: string
    emailDate: string
    matchedJobs: Array<{ id: string; title: string; company: string }>
    suggestedStatus?: string
    emailType?: string
    emailTextBody?: string
  }

  const jobIds = metadata.matchedJobs.map((job) => job.id)
  const jobs = await prisma.job.findMany({
    where: {
      id: { in: jobIds },
      userId: user.id,
    },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      status: true,
      url: true,
      appliedAt: true,
      interviewAt: true,
    },
    orderBy: {
      savedAt: 'desc',
    },
  })

  const orderedJobs = metadata.matchedJobs
    .map((matched) => jobs.find((job) => job.id === matched.id))
    .filter(Boolean) as typeof jobs

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <AmbiguousMatchResolver
            notificationId={notification.id}
            emailSubject={metadata.emailSubject}
            emailFrom={metadata.emailFrom}
            emailDate={metadata.emailDate}
            matchedJobs={serializeForClient(orderedJobs)}
            suggestedStatus={metadata.suggestedStatus}
            emailType={metadata.emailType}
            emailTextBody={metadata.emailTextBody}
          />
        </div>
      </div>
    </AppShell>
  )
}
