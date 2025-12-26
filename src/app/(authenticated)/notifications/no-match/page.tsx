import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { NoMatchJobCreator } from '@/components/notifications/no-match-job-creator'
import { notFound } from 'next/navigation'

export default async function NoMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ notificationId?: string; emailSubject?: string }>
}) {
  const user = await requireAuth()
  const params = await searchParams
  const { notificationId, emailSubject } = params

  console.log('NoMatchPage - searchParams:', { notificationId, emailSubject, userId: user.id })

  // Fetch the notification
  let notification = null
  if (notificationId) {
    console.log('Looking up notification by ID:', notificationId)
    notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
        type: 'NEW_JOB_DETECTED',
      },
    })
    console.log('Notification found by ID:', notification ? 'yes' : 'no')
  } else if (emailSubject) {
    console.log('Looking up notification by emailSubject:', emailSubject)
    // Try Prisma JSON path query first
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
    
    // Fallback: if Prisma query doesn't work, fetch all and filter in memory
    if (!notification) {
      console.log('Prisma JSON query failed, trying in-memory filter')
      const allNotifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
          type: 'NEW_JOB_DETECTED',
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      
      console.log(`Found ${allNotifications.length} NEW_JOB_DETECTED notifications`)
      
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
    // If neither is provided, try to find the most recent unread unmatched email notification
    console.log('No notificationId or emailSubject, looking for most recent unread unmatched')
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
    console.log('Most recent unread unmatched found:', notification ? 'yes' : 'no')
  }

  if (!notification) {
    console.error('No-match notification not found', { 
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
    company?: string
    title?: string
    hasInsufficientInfo?: boolean
    emailTextBody?: string
  }

  return (
    <div className="size-full flex">
      <Sidebar />
      <SimpleTopBar />
      <div
        className="flex-1 flex flex-col relative z-10"
        style={{ marginLeft: '4rem' }}
      >
        <div className="flex-1 overflow-auto pt-[88px]">
          <div className="max-w-4xl mx-auto px-8 py-6">
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
      </div>
    </div>
  )
}
