import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { NoMatchJobCreator } from '@/components/notifications/no-match-job-creator'
import { notFound } from 'next/navigation'

const NEW_JOB_FALLBACK_TAKE = 200

export default async function NoMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ notificationId?: string; emailSubject?: string }>
}) {
  const user = await requireAuth()
  const params = await searchParams
  const { notificationId, emailSubject } = params

  let notification = null
  if (notificationId) {
    notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
        type: 'NEW_JOB_DETECTED',
      },
    })
  } else if (emailSubject) {
    notification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: 'NEW_JOB_DETECTED',
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
          type: 'NEW_JOB_DETECTED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: NEW_JOB_FALLBACK_TAKE,
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
        type: 'NEW_JOB_DETECTED',
        title: 'New Email Detected',
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
    company?: string
    title?: string
    hasInsufficientInfo?: boolean
    emailTextBody?: string
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <NoMatchJobCreator
            notificationId={notification.id}
            emailSubject={metadata.emailSubject}
            emailFrom={metadata.emailFrom}
            emailDate={metadata.emailDate}
            company={metadata.company}
            title={metadata.title}
            emailTextBody={metadata.emailTextBody}
          />
        </div>
      </div>
    </AppShell>
  )
}
