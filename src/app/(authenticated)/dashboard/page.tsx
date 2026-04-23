import type { ComponentProps } from 'react'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPageContent } from '@/components/dashboard/dashboard-page-content'
import { JobStatus } from '@prisma/client'
import { serializeForClient } from '@/lib/serialize-for-client'
import {
  getRecentActivities,
  getRecentNotifications,
} from '@/lib/cached-queries'

type DashboardProps = ComponentProps<typeof DashboardPageContent>

export const revalidate = 30 // Revalidate every 30 seconds

export default async function DashboardPage() {
  const user = await requireAuth()

  // The shell fetches its own banner state; we only need the page-level data.
  const [statusCounts, recentActivities, notificationsRaw] = await Promise.all([
    prisma.job.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    }),
    getRecentActivities(user.id, 50),
    getRecentNotifications(user.id, 50),
  ])

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

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <DashboardPageContent
          statusCounts={statusCountsMap}
          activities={
            serializeForClient(recentActivities) as unknown as DashboardProps['activities']
          }
          notifications={
            serializeForClient(notificationsRaw) as unknown as DashboardProps['notifications']
          }
        />
      </div>
    </AppShell>
  )
}

