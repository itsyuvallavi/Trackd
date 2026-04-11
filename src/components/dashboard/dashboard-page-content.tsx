'use client'

import { useState } from 'react'
import { ActivityType, JobStatus, NotificationType } from '@prisma/client'
import { StatusStats } from './status-stats'
import { ActivityFeed } from './activity-feed'
import { NotificationsFeed } from './notifications-feed'
import { Bell, Activity } from 'lucide-react'
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

interface DashboardPageContentProps {
  statusCounts: Record<JobStatus, number>
  activities: Activity[]
  notifications: Notification[]
}

type ViewMode = 'changes' | 'notifications'

export function DashboardPageContent({ 
  statusCounts, 
  activities, 
  notifications 
}: DashboardPageContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('changes')

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your job applications
        </p>
      </div>

      {/* Status Stats */}
      <div className="mb-6 md:mb-8">
        <StatusStats counts={statusCounts} />
      </div>

      {/* View Toggle - Activity = timeline; Notifications = inbox (sync alerts, matches, errors) */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex-1 h-9 text-sm transition-all',
              'hover:bg-background/70 hover:text-foreground',
              viewMode === 'changes' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'bg-transparent text-muted-foreground'
            )}
            onClick={() => setViewMode('changes')}
          >
            <Activity className="size-4 mr-2" />
            Recent Activity
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex-1 h-9 text-sm transition-all',
              'hover:bg-background/70 hover:text-foreground',
              viewMode === 'notifications' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'bg-transparent text-muted-foreground'
            )}
            onClick={() => setViewMode('notifications')}
          >
            <Bell className="size-4 mr-2" />
            Notifications
          </Button>
        </div>
        <p className="text-xs text-muted-foreground px-0.5">
          {viewMode === 'changes'
            ? 'Timeline of status changes, emails, and notes across your jobs.'
            : 'Alerts from email sync (new roles, ambiguous matches, errors). Routine job updates appear in Recent Activity.'}
        </p>
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {viewMode === 'changes' ? (
          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <ActivityFeed activities={activities} isCollapsible={false} />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <NotificationsFeed notifications={notifications} />
          </div>
        )}
      </div>
    </div>
  )
}

