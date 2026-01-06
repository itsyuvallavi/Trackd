import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPageContent } from '@/components/dashboard/dashboard-page-content'
import { JobStatus } from '@prisma/client'

export const revalidate = 30 // Revalidate every 30 seconds

export default async function DashboardPage() {
  const user = await requireAuth()

  // Fetch data in parallel
  const [statusCounts, recentActivities, notificationsRaw] = await Promise.all([
    // Get status counts
    prisma.job.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    }),
    // Fetch recent activities (last 50)
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
    // Fetch recent notifications (last 50)
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

  // Convert groupBy result to status counts map
  const statusCountsMap: Record<JobStatus, number> = {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  }

  statusCounts.forEach((item) => {
    statusCountsMap[item.status as JobStatus] = item._count
  })

  // Convert notifications createdAt from Date to string
  const notifications = notificationsRaw.map(n => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }))

  const emailIntegration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <DashboardPageContent
          statusCounts={statusCountsMap}
          activities={recentActivities}
          notifications={notifications}
        />
      </div>
    </AppShell>
  )
}

