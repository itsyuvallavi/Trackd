'use client'

import { Activity, ActivityType } from '@prisma/client'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { ACTIVITY_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants'
import {
  Circle,
  StickyNote,
  TrendingUp,
  Mail,
  Calendar,
  XCircle,
  CheckCircle,
} from 'lucide-react'

interface JobTimelineProps {
  activities: Activity[]
}

export function JobTimeline({ activities }: JobTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <StickyNote className="size-8 mx-auto mb-2 opacity-50" />
        <p>No activity yet</p>
      </div>
    )
  }

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'NOTE':
        return <StickyNote className="size-4" />
      case 'STATUS_CHANGE':
        return <TrendingUp className="size-4" />
      case 'EMAIL_UPDATE':
        return <Mail className="size-4" />
      case 'INTERVIEW':
        return <Calendar className="size-4" />
      case 'REJECTION':
        return <XCircle className="size-4" />
      case 'OFFER':
        return <CheckCircle className="size-4" />
      default:
        return <Circle className="size-4" />
    }
  }

  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'INTERVIEW':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30'
      case 'REJECTION':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
      case 'OFFER':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
      case 'EMAIL_UPDATE':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
      case 'STATUS_CHANGE':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30'
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30'
    }
  }

  return (
    <div className="relative">
      <div className="space-y-4 md:space-y-6">
        {activities.map((activity, index) => {
          const iconColorClass = getActivityColor(activity.type)
          const Icon = getActivityIcon(activity.type)
          const isLast = index === activities.length - 1

          return (
            <div key={activity.id} className="relative flex gap-3 md:gap-4">
              {/* Timeline line - centered on icon 
                  Icon is size-10 (40px) on mobile, size-12 (48px) on desktop
                  Center is at 20px on mobile, 24px on desktop */}
              {!isLast && (
                <div 
                  className="absolute top-10 md:top-12 bottom-0 w-0.5 bg-border z-0 left-[20px] md:left-[24px]"
                  style={{ transform: 'translateX(-50%)' }}
                />
              )}

              {/* Icon - 40px on mobile, 48px on desktop */}
              <div
                className={`relative z-10 flex items-center justify-center size-10 md:size-12 rounded-full ${iconColorClass} border-2 border-background shrink-0`}
              >
                {Icon}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4 md:pb-6 min-w-0">
                <div className="flex items-start justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <h3 className="font-semibold text-xs md:text-sm">
                      {ACTIVITY_TYPE_LABELS[activity.type]}
                    </h3>
                    {activity.fromStatus && activity.toStatus && (
                      <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                        {STATUS_LABELS[activity.fromStatus]} → {STATUS_LABELS[activity.toStatus]}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatRelativeTime(activity.createdAt)}
                  </div>
                </div>

                {activity.description && (
                  <p className="text-xs md:text-sm text-muted-foreground mb-1 md:mb-2 break-words">{activity.description}</p>
                )}

                <div className="text-[10px] md:text-xs text-muted-foreground">
                  {formatDate(activity.createdAt)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

