import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { AmbiguousMatchResolver } from '@/components/notifications/ambiguous-match-resolver'
import { notFound } from 'next/navigation'
import { serializeForClient } from '@/lib/serialize-for-client'

export default async function AmbiguousMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ emailSubject?: string; notificationId?: string }>
}) {
  const user = await requireAuth()
  const params = await searchParams
  const { emailSubject, notificationId } = params

  console.log('AmbiguousMatchPage - searchParams:', { notificationId, emailSubject, userId: user.id })

  // If notificationId is provided, fetch the notification
  let notification = null
  if (notificationId) {
    console.log('Looking up notification by ID:', notificationId)
    notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
        type: 'AMBIGUOUS_MATCH',
      },
    })
    console.log('Notification found by ID:', notification ? 'yes' : 'no')
  } else if (emailSubject) {
    console.log('Looking up notification by emailSubject:', emailSubject)
    // Otherwise, find the most recent ambiguous match notification with this subject
    // Try Prisma JSON path query first
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
    
    // Fallback: if Prisma query doesn't work, fetch all and filter in memory
    if (!notification) {
      console.log('Prisma JSON query failed, trying in-memory filter')
      const allNotifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
          type: 'AMBIGUOUS_MATCH',
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      
      console.log(`Found ${allNotifications.length} ambiguous match notifications`)
      
      notification = allNotifications.find(n => {
        const meta = n.metadata as any
        const decodedSubject = decodeURIComponent(emailSubject)
        const match = meta?.emailSubject === decodedSubject
        if (match) {
          console.log('Found matching notification:', n.id)
        }
        return match
      }) || null
    }
  } else {
    // If neither is provided, try to find the most recent unread ambiguous match
    console.log('No notificationId or emailSubject, looking for most recent unread')
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
    console.log('Most recent unread found:', notification ? 'yes' : 'no')
  }

  if (!notification) {
    console.error('Ambiguous match notification not found', { 
      notificationId, 
      emailSubject, 
      userId: user.id,
      hasNotificationId: !!notificationId,
      hasEmailSubject: !!emailSubject
    })
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

  // Fetch full job details for the matched jobs
  const jobIds = metadata.matchedJobs.map(job => job.id)
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

  // Ensure jobs are in the same order as matchedJobs
  const orderedJobs = metadata.matchedJobs
    .map(matched => jobs.find(job => job.id === matched.id))
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
