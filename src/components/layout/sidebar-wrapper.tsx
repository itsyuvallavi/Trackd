'use client'

import { useState } from 'react'
import { AppShell } from './app-shell'
import { PageWithSidebar } from './page-with-sidebar'
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

interface SidebarWrapperProps {
  children: React.ReactNode
  activities: Activity[]
  notifications: Notification[]
  showEmailNotification?: boolean
}

export function SidebarWrapper({ 
  children, 
  activities, 
  notifications,
  showEmailNotification 
}: SidebarWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AppShell 
      showEmailNotification={showEmailNotification}
    >
      <PageWithSidebar 
        activities={activities} 
        notifications={notifications}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        {children}
      </PageWithSidebar>
    </AppShell>
  )
}

