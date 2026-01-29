'use client'

import { useState } from 'react'
import { ActivityFeed } from './activity-feed'
import { NotificationsFeed } from './notifications-feed'
import { ActivityType, JobStatus, NotificationType } from '@prisma/client'
import { Bell, Activity, ChevronRight } from 'lucide-react'
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
  onExpand?: () => void
  isCollapsible?: boolean
  isCollapsed?: boolean
}

type ViewMode = 'changes' | 'notifications'

export function SidebarDashboard({ activities, notifications, onClose, onExpand, isCollapsible = true, isCollapsed: externalIsCollapsed }: SidebarDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('changes')
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  
  // Use external collapsed state if provided, otherwise use internal state
  const isCollapsed = externalIsCollapsed ?? internalIsCollapsed

  // Show all activities in the Changes view
  // Previously filtered to only STATUS_CHANGE and job additions, but now showing all
  const filteredActivities = activities

  const handleCollapse = () => {
    if (externalIsCollapsed !== undefined) {
      // Controlled component - call onClose
      onClose?.()
    } else {
      // Uncontrolled component - use internal state
      setInternalIsCollapsed(true)
      onClose?.()
    }
  }

  const handleExpand = () => {
    if (externalIsCollapsed !== undefined) {
      // Controlled component - call onExpand
      onExpand?.()
    } else {
      // Uncontrolled component - use internal state
      setInternalIsCollapsed(false)
      onExpand?.()
    }
  }

  if (isCollapsed) {
    return (
      <div className={cn(
        'w-8 border-l border-border bg-card flex flex-col fixed right-0 top-[64px] bottom-0 h-[calc(100vh-64px)] z-30',
        'transition-all duration-500 ease-out',
        'animate-in slide-in-from-right-full'
      )}>
        <div className="bg-card border-b border-border px-2 pt-6 pb-2.5 flex items-center justify-center shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rotate-180 transition-transform duration-500 ease-out"
            onClick={handleExpand}
            aria-label="Expand dashboard"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'w-[266px] border-l border-border bg-card flex flex-col fixed right-0 top-[64px] bottom-0 h-[calc(100vh-64px)] z-30',
      'transition-all duration-500 ease-out',
      'animate-in slide-in-from-right-full'
    )}>
      {/* Header with Toggle */}
      <div className="bg-card border-b border-border px-3 pt-6 pb-2.5 flex items-center justify-between z-10 shrink-0">
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
              className="h-6 w-6 transition-transform duration-500 ease-out"
              onClick={handleCollapse}
              aria-label="Minimize dashboard"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Area - Independently scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain animate-in fade-in duration-500 delay-100 ease-out">
        {viewMode === 'changes' ? (
          <ActivityFeed activities={filteredActivities} isCollapsible={false} />
        ) : (
          <NotificationsFeed notifications={notifications} />
        )}
      </div>
    </div>
  )
}

