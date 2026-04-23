'use client'

import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { NotificationType, JobStatus } from '@prisma/client'
import { 
  Mail, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Bell,
  ArrowRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

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

interface NotificationsFeedProps {
  notifications: Notification[]
}

export function NotificationsFeed({ notifications }: NotificationsFeedProps) {
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const dismissNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'NEW_JOB_DETECTED':
        return <Mail className="size-3.5" />
      case 'AMBIGUOUS_MATCH':
        return <AlertCircle className="size-3.5" />
      case 'JOB_UPDATED':
        return <ArrowRight className="size-3.5" />
      case 'SYNC_COMPLETE':
        return <CheckCircle2 className="size-3.5" />
      case 'SYNC_ERROR':
        return <XCircle className="size-3.5" />
      default:
        return <Bell className="size-3.5" />
    }
  }

  const getNotificationColor = (type: NotificationType, isRead: boolean) => {
    if (isRead) return 'text-muted-foreground'
    
    switch (type) {
      case 'NEW_JOB_DETECTED':
        return 'text-info'
      case 'AMBIGUOUS_MATCH':
        return 'text-warning'
      case 'JOB_UPDATED':
        return 'text-primary'
      case 'SYNC_COMPLETE':
        return 'text-success'
      case 'SYNC_ERROR':
        return 'text-error'
      default:
        return 'text-muted-foreground'
    }
  }

  const formatNotificationContent = (notification: Notification) => {
    // For JOB_UPDATED notifications, always show status change badges
    if (notification.type === 'JOB_UPDATED' && notification.metadata) {
      const metadata = notification.metadata as {
        jobId?: string
        jobTitle?: string
        company?: string
        oldStatus?: JobStatus | null
        newStatus?: JobStatus
      }
      
      // Always show badges, even if oldStatus === newStatus
      if (metadata.newStatus) {
        const fromStatus = metadata.oldStatus || null
        const toStatus = metadata.newStatus
        
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {fromStatus ? (
              <>
                <Badge className={cn('text-[10px]', STATUS_COLORS[fromStatus])}>
                  {STATUS_LABELS[fromStatus]}
                </Badge>
                <ArrowRight className="size-2.5 text-muted-foreground" />
              </>
            ) : null}
            <Badge className={cn('text-[10px]', STATUS_COLORS[toStatus])}>
              {STATUS_LABELS[toStatus]}
            </Badge>
          </div>
        )
      }
    }
    
    // For other notification types, show a simplified message
    return (
      <p className="text-[10px] text-muted-foreground line-clamp-2">
        {notification.message}
      </p>
    )
  }

  const getJobInfo = (notification: Notification) => {
    if (notification.type === 'JOB_UPDATED' && notification.metadata) {
      const metadata = notification.metadata as {
        jobTitle?: string
        company?: string
      }
      return {
        title: metadata.jobTitle || notification.title,
        company: metadata.company || '',
      }
    }
    
    // Try to extract from message for other types
    const lines = notification.message.split('\n')
    return {
      title: notification.title,
      company: lines[0] || '',
    }
  }

  // Filter out NEW_JOB_DETECTED notifications - they should only appear in Changes as activities
  const filteredNotifications = notifications.filter(
    (notification) => notification.type !== 'NEW_JOB_DETECTED'
  )

  return (
    <div className="p-3 space-y-2">
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground animate-in fade-in duration-500 delay-150 ease-out">
          <p className="text-sm">No notifications</p>
          <p className="text-xs mt-1">You&apos;re all caught up</p>
        </div>
      ) : (
        filteredNotifications.map((notification, index) => {
          const jobInfo = getJobInfo(notification)
          // Staggered animation - icons appear first, then content (same as chat history)
          const iconDelay = 250 + (index * 60) // Icons appear first (250ms base + stagger)
          const contentDelay = 400 + (index * 60) // Content appears after icons

          return (
            <Link
              key={notification.id}
              href={notification.actionUrl || '#'}
              className={cn(
                'block p-2.5 rounded-lg border border-border hover:bg-accent/50 transition-colors group',
                'animate-in fade-in duration-500 ease-out',
                !notification.isRead && 'bg-primary-lightest/30 border-primary/20'
              )}
              style={{
                animationDelay: `${contentDelay}ms`
              }}
            >
              <div className="flex items-start gap-2">
                <div 
                  className={cn(
                    'mt-0.5 shrink-0 animate-in fade-in zoom-in-50 duration-500 ease-out',
                    getNotificationColor(notification.type, notification.isRead)
                  )}
                  style={{
                    animationDelay: `${iconDelay}ms`
                  }}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1.5 mb-0.5">
                    <p className={cn(
                      'text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors',
                      notification.isRead ? 'text-muted-foreground' : 'text-foreground'
                    )}>
                      {jobInfo.title}
                    </p>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {formatRelativeTime(new Date(notification.createdAt))}
                    </span>
                  </div>
                  {jobInfo.company && (
                    <p className="text-[10px] text-muted-foreground mb-1 line-clamp-1">
                      {jobInfo.company}
                    </p>
                  )}
                  {formatNotificationContent(notification)}
                </div>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}

