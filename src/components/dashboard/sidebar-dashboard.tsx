'use client'

import { useState } from 'react'
import { ActivityFeed } from './activity-feed'
import { NotificationsFeed } from './notifications-feed'
import { ActivityType, JobStatus, NotificationType } from '@prisma/client'
import { Bell, Activity, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

interface SidebarDashboardProps {
  activities: Activity[]
  notifications: Notification[]
  onClose?: () => void
  isCollapsible?: boolean
}

type ViewMode = 'changes' | 'notifications'

export function SidebarDashboard({ activities, notifications, onClose, isCollapsible = false }: SidebarDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('changes')

  // Show all activities in the Changes view
  // Previously filtered to only STATUS_CHANGE and job additions, but now showing all
  const filteredActivities = activities

  return (
    <div className="w-[266px] border-l border-border bg-card flex flex-col fixed right-0 top-[80px] bottom-0 h-[calc(100vh-80px)] slide-in-from-right-full duration-300">
      {/* Header with Toggle */}
      <div className="bg-card border-b border-border px-3 py-2.5 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 text-xs transition-all',
              'hover:bg-background/70 hover:text-foreground',
              'active:bg-background active:text-foreground',
              viewMode === 'changes' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'bg-transparent text-muted-foreground'
            )}
            onClick={() => setViewMode('changes')}
          >
            <Activity className="size-3.5 mr-1.5" />
            Changes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 text-xs transition-all',
              'hover:bg-background/70 hover:text-foreground',
              'active:bg-background active:text-foreground',
              viewMode === 'notifications' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'bg-transparent text-muted-foreground'
            )}
            onClick={() => setViewMode('notifications')}
          >
            <Bell className="size-3.5 mr-1.5" />
            Notifications
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {isCollapsible && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              onClick={onClose}
              aria-label="Close dashboard"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'changes' ? (
          <ActivityFeed activities={filteredActivities} isCollapsible={false} />
        ) : (
          <NotificationsFeed notifications={notifications} />
        )}
      </div>
    </div>
  )
}

