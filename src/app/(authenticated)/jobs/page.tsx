import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { JobsPageContent } from '@/components/jobs/jobs-page-content'
import { SidebarWrapper } from '@/components/layout/sidebar-wrapper'

export const revalidate = 60 // Revalidate every 60 seconds

export default async function JobsPage() {
  const user = await requireAuth()

  // Auto-archive jobs older than 2 weeks (14 days) that aren't already archived or rejected
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  
  // Update jobs that should be archived
  await prisma.job.updateMany({
    where: {
      userId: user.id,
      status: {
        notIn: ['ARCHIVED', 'REJECTED'] as any, // Don't archive already archived or rejected jobs
      },
      createdAt: {
        lt: twoWeeksAgo, // Created more than 2 weeks ago
      },
    },
    data: {
      status: 'ARCHIVED' as any,
    },
  })

  // Fetch jobs, recent activities, and notifications in parallel
  const [jobs, recentActivities, notificationsRaw] = await Promise.all([
    // Pagination: Load first 100 jobs initially (sufficient for most users)
    prisma.job.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        status: true,
        priority: true,
        source: true,
        url: true,
        savedAt: true,
        appliedAt: true,
        interviewAt: true,
        nextAction: true,
        tags: true,
        notes: true,
        salary: true,
        contactName: true,
        contactEmail: true,
        createdAt: true,
        updatedAt: true,
        activities: {
          orderBy: { createdAt: 'asc' },
          take: 5, // Limit to 5 most recent activities for initial load
          select: {
            id: true,
            type: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            description: true,
          },
        },
      },
      orderBy: { savedAt: 'desc' },
      take: 100, // Initial page size
    }),
    // Fetch recent activities for the sidebar (last 50)
    prisma.activity.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        fromStatus: true,
        toStatus: true,
        description: true,
        createdAt: true,
        job: {
          select: {
            id: true,
            title: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    // Fetch recent notifications for the sidebar (last 50)
    prisma.notification.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        metadata: true,
        isRead: true,
        actionUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  // Convert notifications createdAt from Date to string
  const notifications = notificationsRaw.map(n => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }))

  const emailIntegration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  return (
    <SidebarWrapper 
      activities={recentActivities} 
      notifications={notifications}
      showEmailNotification={!emailIntegration}
    >
      <div className="w-full flex justify-center px-4 md:px-8 py-4 md:py-6">
        <div className="w-full max-w-[1160px]">
          <JobsPageContent jobs={jobs} />
        </div>
      </div>
    </SidebarWrapper>
  )
}
