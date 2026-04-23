'use client'

import { Activity, ActivityType } from '@prisma/client'
import { formatDate, formatRelativeTime, cn } from '@/lib/utils'
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

// Tokenized color map — aligns with globals.css status/info/warning/error tokens.
const ACTIVITY_TOKEN: Record<
  ActivityType,
  { bg: string; text: string; ring: string }
> = {
  NOTE: {
    bg: 'bg-foreground/[0.06]',
    text: 'text-foreground/70',
    ring: 'ring-border/60',
  },
  STATUS_CHANGE: {
    bg: 'bg-saved-bg',
    text: 'text-saved-text',
    ring: 'ring-saved/30',
  },
  EMAIL_UPDATE: {
    bg: 'bg-info-bg',
    text: 'text-info-text',
    ring: 'ring-info/30',
  },
  INTERVIEW: {
    bg: 'bg-interview-bg',
    text: 'text-interview-text',
    ring: 'ring-interview/30',
  },
  REJECTION: {
    bg: 'bg-error-bg',
    text: 'text-error-text',
    ring: 'ring-error/30',
  },
  OFFER: {
    bg: 'bg-success-bg',
    text: 'text-success-text',
    ring: 'ring-success/30',
  },
}

export function JobTimeline({ activities }: JobTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <StickyNote className="size-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
      </div>
    )
  }

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'NOTE':
        return <StickyNote className="size-3.5" />
      case 'STATUS_CHANGE':
        return <TrendingUp className="size-3.5" />
      case 'EMAIL_UPDATE':
        return <Mail className="size-3.5" />
      case 'INTERVIEW':
        return <Calendar className="size-3.5" />
      case 'REJECTION':
        return <XCircle className="size-3.5" />
      case 'OFFER':
        return <CheckCircle className="size-3.5" />
      default:
        return <Circle className="size-3.5" />
    }
  }

  return (
    <div className="relative">
      {/* Connector line — hairline, spanning full timeline behind the icons. */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 w-px bg-border/60 left-[15px] md:left-[17px]"
      />

      <ol className="space-y-5 md:space-y-6">
        {activities.map((activity) => {
          const token = ACTIVITY_TOKEN[activity.type] ?? ACTIVITY_TOKEN.NOTE
          const Icon = getActivityIcon(activity.type)

          return (
            <li key={activity.id} className="relative flex gap-3 md:gap-4">
              {/* Icon — colored disc with ring */}
              <div
                className={cn(
                  'relative z-10 flex items-center justify-center size-8 md:size-9 rounded-full shrink-0 ring-1',
                  token.bg,
                  token.text,
                  token.ring
                )}
              >
                {Icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between mb-0.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <h3 className="font-medium text-sm text-foreground">
                      {ACTIVITY_TYPE_LABELS[activity.type]}
                    </h3>
                    {activity.fromStatus && activity.toStatus && (
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                        {STATUS_LABELS[activity.fromStatus]} →{' '}
                        {STATUS_LABELS[activity.toStatus]}
                      </span>
                    )}
                  </div>
                  <time
                    className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 tabular-nums"
                    suppressHydrationWarning
                  >
                    {formatRelativeTime(activity.createdAt)}
                  </time>
                </div>

                {activity.description && (
                  <p className="text-sm text-muted-foreground mb-1 break-words">
                    {activity.description}
                  </p>
                )}

                <div className="text-[11px] text-muted-foreground/70 tabular-nums">
                  {formatDate(activity.createdAt)}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
