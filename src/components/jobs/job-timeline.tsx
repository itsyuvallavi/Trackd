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
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {activities.map((activity, index) => {
          const iconColorClass = getActivityColor(activity.type)
          const Icon = getActivityIcon(activity.type)

          return (
            <div key={activity.id} className="relative flex gap-4">
              {/* Icon */}
              <div
                className={`relative z-10 flex items-center justify-center size-12 rounded-full ${iconColorClass} border-2 border-background`}
              >
                {Icon}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">
                      {ACTIVITY_TYPE_LABELS[activity.type]}
                    </h3>
                    {activity.fromStatus && activity.toStatus && (
                      <span className="text-xs text-muted-foreground">
                        {STATUS_LABELS[activity.fromStatus]} → {STATUS_LABELS[activity.toStatus]}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(activity.createdAt)}
                  </div>
                </div>

                {activity.description && (
                  <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                )}

                <div className="text-xs text-muted-foreground">
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

