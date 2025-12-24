import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { AmbiguousMatchResolver } from '@/components/notifications/ambiguous-match-resolver'
import { notFound } from 'next/navigation'

export default async function AmbiguousMatchPage({
  searchParams,
}: {
  searchParams: { emailSubject?: string; notificationId?: string }
}) {
  const user = await requireAuth()
  const { emailSubject, notificationId } = searchParams

  // If notificationId is provided, fetch the notification
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
    // Otherwise, find the most recent ambiguous match notification with this subject
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
    <div className="size-full flex">
      <Sidebar />
      <SimpleTopBar />
      <div
        className="flex-1 flex flex-col relative z-10"
        style={{ marginLeft: '4rem' }}
      >
        <div className="flex-1 overflow-auto pt-[88px]">
          <div className="max-w-4xl mx-auto px-8 py-6">
            <AmbiguousMatchResolver
              notificationId={notification.id}
              emailSubject={metadata.emailSubject}
              emailFrom={metadata.emailFrom}
              emailDate={metadata.emailDate}
              matchedJobs={orderedJobs}
              suggestedStatus={metadata.suggestedStatus}
              emailType={metadata.emailType}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
