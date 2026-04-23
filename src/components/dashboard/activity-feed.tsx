'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS, ACTIVITY_TYPE_LABELS } from '@/lib/constants'
import { ActivityType, JobStatus } from '@prisma/client'
import { 
  ArrowRight, 
  Mail, 
  FileText, 
  Calendar, 
  X, 
  CheckCircle2, 
  XCircle,
  Plus,
  ChevronRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

interface ActivityFeedProps {
  activities: Activity[]
  onClose?: () => void
  isCollapsible?: boolean
}

export function ActivityFeed({ activities, onClose, isCollapsible = false }: ActivityFeedProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleCollapse = () => {
    setIsCollapsed(true)
    if (onClose) {
      onClose()
    }
  }

  const getActivityIcon = (type: ActivityType, description?: string | null, fromStatus?: JobStatus | null, toStatus?: JobStatus | null) => {
    // Check if it's a job creation note
    if (type === 'NOTE' && description?.toLowerCase().includes('created')) {
      return <Plus className="size-3.5" />
    }
    
    // If activity has status change, use arrow icon
    if (fromStatus !== null && fromStatus !== undefined && toStatus !== null && toStatus !== undefined) {
      return <ArrowRight className="size-3.5" />
    }
    
    switch (type) {
      case 'STATUS_CHANGE':
        return <ArrowRight className="size-3.5" />
      case 'EMAIL_UPDATE':
        return <Mail className="size-3.5" />
      case 'NOTE':
        return <FileText className="size-3.5" />
      case 'INTERVIEW':
        return <Calendar className="size-3.5" />
      case 'OFFER':
        return <CheckCircle2 className="size-3.5" />
      case 'REJECTION':
        return <XCircle className="size-3.5" />
      default:
        return <FileText className="size-3.5" />
    }
  }

  const getActivityColor = (type: ActivityType, description?: string | null, fromStatus?: JobStatus | null, toStatus?: JobStatus | null) => {
    // Job creation notes
    if (type === 'NOTE' && description?.toLowerCase().includes('created')) {
      return 'text-success'
    }
    
    // If activity has status change, use primary color
    if (fromStatus !== null && fromStatus !== undefined && toStatus !== null && toStatus !== undefined) {
      return 'text-primary'
    }
    
    switch (type) {
      case 'STATUS_CHANGE':
        return 'text-primary'
      case 'EMAIL_UPDATE':
        return 'text-info'
      case 'INTERVIEW':
        return 'text-interview'
      case 'OFFER':
        return 'text-success'
      case 'REJECTION':
        return 'text-error'
      default:
        return 'text-muted-foreground'
    }
  }

  const formatActivityDescription = (activity: Activity) => {
    // Show status change badges if fromStatus and toStatus exist (regardless of activity type)
    if (activity.fromStatus !== null && activity.fromStatus !== undefined && 
        activity.toStatus !== null && activity.toStatus !== undefined) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={cn('text-[10px]', STATUS_COLORS[activity.fromStatus])}>
            {STATUS_LABELS[activity.fromStatus]}
          </Badge>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <Badge className={cn('text-[10px]', STATUS_COLORS[activity.toStatus])}>
            {STATUS_LABELS[activity.toStatus]}
          </Badge>
        </div>
      )
    }
    // Job creation - check multiple ways it might be indicated
    const isJobCreation = 
      (activity.type === 'NOTE' && activity.description?.toLowerCase().includes('created')) ||
      (activity.description?.toLowerCase().includes('job') && activity.description?.toLowerCase().includes('created')) ||
      (activity.type === 'NOTE' && !activity.fromStatus && !activity.toStatus && activity.description?.toLowerCase().includes('at'))
    
    if (isJobCreation) {
      return (
        <div className="flex items-center gap-1.5">
          <Badge className="text-[10px] bg-success-bg text-success-text border-success/25">
            Job Added
          </Badge>
        </div>
      )
    }
    // For other activity types, show a badge with the activity type label
    const badgeColors: Record<ActivityType, string> = {
      STATUS_CHANGE: 'bg-primary/10 text-primary border-primary/20',
      EMAIL_UPDATE: 'bg-info-bg text-info-text border-info/25',
      NOTE: 'bg-muted text-muted-foreground border-border',
      INTERVIEW: 'bg-interview-bg text-interview-text border-interview/25',
      OFFER: 'bg-success-bg text-success-text border-success/25',
      REJECTION: 'bg-error-bg text-error-text border-error/25',
    }
    
    return (
      <div className="flex items-center gap-1.5">
        <Badge className={cn('text-[10px]', badgeColors[activity.type] || badgeColors.NOTE)}>
          {ACTIVITY_TYPE_LABELS[activity.type]}
        </Badge>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground animate-in fade-in duration-500 delay-150 ease-out">
            <p className="text-sm">No recent activity</p>
            <p className="text-xs mt-1">Activity will appear here as you use Trackd</p>
          </div>
        ) : (
          activities.map((activity, index) => {
            // Staggered animation - icons appear first, then content (same as chat history)
            const iconDelay = 250 + (index * 60) // Icons appear first (250ms base + stagger)
            const contentDelay = 400 + (index * 60) // Content appears after icons

            return (
              <Link
                key={activity.id}
                href={`/jobs/${activity.job.id}`}
                className={cn(
                  'block p-2.5 rounded-lg border border-border hover:bg-accent/50 transition-colors group',
                  'animate-in fade-in duration-500 ease-out'
                )}
                style={{
                  animationDelay: `${contentDelay}ms`
                }}
              >
                <div className="flex items-start gap-2">
                  <div 
                    className={cn(
                      'mt-0.5 shrink-0 animate-in fade-in zoom-in-50 duration-500 ease-out',
                      getActivityColor(activity.type, activity.description, activity.fromStatus, activity.toStatus)
                    )}
                    style={{
                      animationDelay: `${iconDelay}ms`
                    }}
                  >
                    {getActivityIcon(activity.type, activity.description, activity.fromStatus, activity.toStatus)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5 mb-0.5">
                      <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {activity.job.title}
                      </p>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {formatRelativeTime(activity.createdAt)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-1 line-clamp-1">
                      {activity.job.company}
                    </p>
                    {formatActivityDescription(activity)}
                  </div>
                </div>
              </Link>
            )
          })
        )}
    </div>
  )
}

