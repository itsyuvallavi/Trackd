'use client'

import { useState } from 'react'
import { SidebarDashboard } from '@/components/dashboard/sidebar-dashboard'
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

interface PageWithSidebarProps {
  children: React.ReactNode
  activities: Activity[]
  notifications: Notification[]
  showSidebar?: boolean
  sidebarOpen?: boolean
  onSidebarToggle?: (open: boolean) => void
}

export function PageWithSidebar({ 
  children, 
  activities, 
  notifications, 
  showSidebar = true,
  sidebarOpen: controlledSidebarOpen,
  onSidebarToggle
}: PageWithSidebarProps) {
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(true)
  
  // Use controlled state if provided, otherwise use internal state
  const sidebarOpen = controlledSidebarOpen ?? internalSidebarOpen
  const setSidebarOpen = onSidebarToggle ?? setInternalSidebarOpen

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Main Content - centered, no left padding (dashboard overlays) */}
      <div className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>

      {/* Fixed Sidebar Dashboard - Hidden on mobile, visible on desktop, overlays content */}
      {showSidebar && sidebarOpen && (
        <div className="hidden lg:block">
          <SidebarDashboard 
            activities={activities}
            notifications={notifications}
            isCollapsible={true}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

