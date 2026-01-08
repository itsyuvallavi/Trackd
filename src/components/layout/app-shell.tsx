'use client'

import { useState, useEffect } from 'react'
import { SimpleTopBar } from './simple-top-bar'
import { LeftSidebar } from './left-sidebar'
import { FloatingFeedbackButton } from '@/components/feedback/floating-feedback-button'
import { NotificationsBell } from './notifications-bell'
import { SidebarDashboard } from '@/components/dashboard/sidebar-dashboard'
import { ActivityType, JobStatus, NotificationType } from '@prisma/client'
import useSWR from 'swr'

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

interface AppShellProps {
  children: React.ReactNode
  showEmailNotification?: boolean
  sidebarOpen?: boolean
  onSidebarToggle?: (open: boolean) => void
}

export function AppShell({ children, showEmailNotification, sidebarOpen: controlledSidebarOpen, onSidebarToggle: controlledOnSidebarToggle }: AppShellProps) {
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false)
  
  // Use controlled state if provided, otherwise use internal state
  const sidebarOpen = controlledSidebarOpen ?? internalSidebarOpen
  const setSidebarOpen = controlledOnSidebarToggle ?? setInternalSidebarOpen

  // Fetch dashboard data for sidebar using SWR (uses global fetcher from SWRConfig)
  const { data } = useSWR<{ activities: Activity[]; notifications: Notification[] }>(
    sidebarOpen ? '/api/dashboard/sidebar' : null, // Only fetch when sidebar is open
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // Refresh every 30 seconds when sidebar is open
    }
  )

  const handleDashboardToggle = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SimpleTopBar 
        showEmailNotification={showEmailNotification}
        onDashboardToggle={handleDashboardToggle}
        isDashboardOpen={sidebarOpen}
      />

      {/* Mobile Notification Icon - Top Right */}
      <div className="fixed top-4 right-4 z-[9999] md:hidden safe-area-top">
        <NotificationsBell showEmailNotification={showEmailNotification} />
      </div>

      <div className="flex flex-1 relative">
        {/* Left Sidebar - Fixed, overlays content */}
        <LeftSidebar />

        {/* Main content area - no margin, sidebar overlays */}
        <main className="flex-1 flex flex-col relative z-0 pt-0 md:pt-[64px] pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Dashboard Sidebar - Desktop only, overlays content */}
      {sidebarOpen && (
        <div className="hidden lg:block">
          <SidebarDashboard 
            activities={data?.activities ?? []}
            notifications={data?.notifications ?? []}
            isCollapsible={true}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      )}

      <FloatingFeedbackButton />
    </div>
  )
}
