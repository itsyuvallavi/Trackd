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
      return 'text-green-500'
    }
    
    // If activity has status change, use primary color
    if (fromStatus !== null && fromStatus !== undefined && toStatus !== null && toStatus !== undefined) {
      return 'text-primary'
    }
    
    switch (type) {
      case 'STATUS_CHANGE':
        return 'text-primary'
      case 'EMAIL_UPDATE':
        return 'text-blue-500'
      case 'INTERVIEW':
        return 'text-purple-500'
      case 'OFFER':
        return 'text-green-500'
      case 'REJECTION':
        return 'text-red-500'
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
          <Badge className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            Job Added
          </Badge>
        </div>
      )
    }
    // For other activity types, show a badge with the activity type label
    const badgeColors: Record<ActivityType, string> = {
      STATUS_CHANGE: 'bg-primary/10 text-primary border-primary/20',
      EMAIL_UPDATE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      NOTE: 'bg-muted text-muted-foreground border-border',
      INTERVIEW: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      OFFER: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
      REJECTION: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
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
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No recent activity</p>
            <p className="text-xs mt-1">Activity will appear here as you use Trackd</p>
          </div>
        ) : (
          activities.map((activity) => (
            <Link
              key={activity.id}
              href={`/jobs/${activity.job.id}`}
              className="block p-2.5 rounded-lg border border-border hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <div className={cn('mt-0.5 shrink-0', getActivityColor(activity.type, activity.description, activity.fromStatus, activity.toStatus))}>
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
          ))
        )}
    </div>
  )
}

