'use client'

import { useState } from 'react'
import { ActivityType, JobStatus, NotificationType } from '@prisma/client'
import { StatusStats } from './status-stats'
import { ActivityFeed } from './activity-feed'
import { NotificationsFeed } from './notifications-feed'
import { Bell, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassPanel } from '@/components/ui/glass'

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

const TABS: { id: ViewMode; label: string; icon: typeof Activity }[] = [
  { id: 'changes', label: 'Recent Activity', icon: Activity },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export function DashboardPageContent({
  statusCounts,
  activities,
  notifications,
}: DashboardPageContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('changes')
  const activeIndex = TABS.findIndex((t) => t.id === viewMode)

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of your job applications.
        </p>
      </header>

      <div className="mb-8">
        <StatusStats counts={statusCounts} />
      </div>

      {/* Segmented tab toggle — animated indicator slides behind the active tab */}
      <div className="mb-3 space-y-2">
        <div className="glass glass-subtle inline-flex items-center gap-1 rounded-full p-1 relative">
          {/* Sliding indicator */}
          <span
            aria-hidden
            className="absolute inset-y-1 rounded-full bg-foreground/8 transition-[left,width] duration-300 ease-[var(--ease-ios)]"
            style={{
              left: `calc(${activeIndex} * 50% + 4px)`,
              width: 'calc(50% - 8px)',
            }}
          />

          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = tab.id === viewMode
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  'relative z-10 flex items-center justify-center gap-2 rounded-full px-4 py-2 min-w-[180px] text-sm font-medium',
                  'transition-colors duration-200',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={active}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {viewMode === 'changes'
            ? 'Timeline of status changes, emails, and notes across your jobs.'
            : 'Alerts from email sync (new roles, ambiguous matches, errors). Routine job updates appear in Recent Activity.'}
        </p>
      </div>

      {/* Feed content in a single animated glass panel */}
      <GlassPanel
        variant="default"
        className="p-4 md:p-6 rounded-2xl"
      >
        <div key={viewMode} className="trackd-route-enter">
          {viewMode === 'changes' ? (
            <ActivityFeed activities={activities} isCollapsible={false} />
          ) : (
            <NotificationsFeed notifications={notifications} />
          )}
        </div>
      </GlassPanel>
    </div>
  )
}
