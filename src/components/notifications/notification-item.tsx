'use client'

import { NotificationType } from '@prisma/client'
import Link from 'next/link'
import { CheckCircle2, X } from 'lucide-react'
import { NewJobDetectedNotification } from './new-job-detected-notification'
import { AmbiguousMatchNotification } from './ambiguous-match-notification'
import { JobUpdatedNotification } from './job-updated-notification'
import { SyncCompleteNotification } from './sync-complete-notification'
import { SyncErrorNotification } from './sync-error-notification'

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

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
  onClose: () => void
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
  onClose,
}: NotificationItemProps) {
  const handleActionClick = () => {
    onClose()
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
  }

  // Render specific notification type component
  switch (notification.type) {
    case 'NEW_JOB_DETECTED':
      return (
        <NewJobDetectedNotification
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDismiss={onDismiss}
          onClose={onClose}
        />
      )
    case 'AMBIGUOUS_MATCH':
      return (
        <AmbiguousMatchNotification
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDismiss={onDismiss}
          onClose={onClose}
        />
      )
    case 'JOB_UPDATED':
      return (
        <JobUpdatedNotification
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDismiss={onDismiss}
          onClose={onClose}
        />
      )
    case 'SYNC_COMPLETE':
      return (
        <SyncCompleteNotification
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDismiss={onDismiss}
          onClose={onClose}
        />
      )
    case 'SYNC_ERROR':
      return (
        <SyncErrorNotification
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDismiss={onDismiss}
          onClose={onClose}
        />
      )
    default:
      // Fallback for unknown types
      return (
        <div
          className={`flex items-start gap-3 px-3 py-2.5 hover:bg-primary-lightest transition-colors border-b border-border last:border-0 ${
            !notification.isRead ? 'bg-primary-lightest/30' : ''
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
              {notification.message}
            </p>
            {notification.actionUrl && (
              <Link
                href={notification.actionUrl}
                className="text-xs text-primary hover:underline mt-1 inline-block"
                onClick={handleActionClick}
              >
                View details →
              </Link>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {!notification.isRead && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Mark as read"
              >
                <CheckCircle2 className="size-4" />
              </button>
            )}
            <button
              onClick={(e) => onDismiss(notification.id, e)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )
  }
}
