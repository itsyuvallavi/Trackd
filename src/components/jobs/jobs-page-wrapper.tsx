'use client'

import { useState } from 'react'
import { JobsPageContent } from './jobs-page-content'
import { SidebarDashboard } from '@/components/dashboard/sidebar-dashboard'
import useSWR from 'swr'
import { ActivityType, JobStatus, NotificationType } from '@prisma/client'

interface Activity {
  id: string
  type: ActivityType
  fromStatus: JobStatus | null
  toStatus: JobStatus | null
  description: string | null
  createdAt: Date
  job: {
    id: string
    title: string
    company: string
  }
}

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  metadata: any
  isRead: boolean
  actionUrl: string | null
  createdAt: string
}

interface Job {
  id: string
  company: string
  title: string
  source: string
  location: string | null
  status: string
  notes: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

interface JobsPageWrapperProps {
  jobs: Job[]
}

export function JobsPageWrapper({ jobs }: JobsPageWrapperProps) {
  const [isDashboardCollapsed, setIsDashboardCollapsed] = useState(false)

  // Fetch dashboard data for sidebar using SWR (always fetch, sidebar is always rendered)
  const { data } = useSWR<{ activities: Activity[]; notifications: Notification[] }>(
    !isDashboardCollapsed ? '/api/dashboard/sidebar' : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // Refresh every 30 seconds when sidebar is open
    }
  )

  const handleDashboardCollapse = () => {
    setIsDashboardCollapsed(true)
  }

  const handleDashboardExpand = () => {
    setIsDashboardCollapsed(false)
  }

  return (
    <>
      {/* Main Content - Always centered, dashboard overlays when open */}
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
          <div className="w-full max-w-[1160px]">
            <JobsPageContent jobs={jobs} />
          </div>
        </div>
      </div>

      {/* Dashboard Sidebar - Desktop only, always rendered (like history), overlays content */}
      <div className="hidden lg:block">
        <SidebarDashboard
          activities={data?.activities ?? []}
          notifications={data?.notifications ?? []}
          isCollapsible={true}
          onClose={handleDashboardCollapse}
          onExpand={handleDashboardExpand}
          isCollapsed={isDashboardCollapsed}
        />
      </div>
    </>
  )
}

