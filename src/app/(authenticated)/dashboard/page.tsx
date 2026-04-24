import type { ComponentProps } from 'react'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPageContent } from '@/components/dashboard/dashboard-page-content'
import { serializeForClient } from '@/lib/serialize-for-client'
import {
  getRecentActivities,
  getRecentNotifications,
  getUserStatusCounts,
} from '@/lib/cached-queries'

type DashboardProps = ComponentProps<typeof DashboardPageContent>

export const revalidate = 30 // Revalidate every 30 seconds

export default async function DashboardPage() {
  const user = await requireAuth()

  const [statusCountsMap, recentActivities, notificationsRaw] = await Promise.all([
    getUserStatusCounts(user.id),
    getRecentActivities(user.id, 50),
    getRecentNotifications(user.id, 50),
  ])

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

