'use client'

import { NotificationType } from '@prisma/client'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

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

interface AmbiguousMatchNotificationProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
  onClose: () => void
}

export function AmbiguousMatchNotification({
  notification,
  onMarkAsRead,
  onDismiss,
  onClose,
}: AmbiguousMatchNotificationProps) {
  const handleActionClick = () => {
    onClose()
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 hover:bg-primary-lightest transition-colors border-b border-border last:border-0 ${
        !notification.isRead ? 'bg-primary-lightest/30' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <AlertCircle className="size-4 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Link
            href={notification.actionUrl?.includes('notificationId=') 
              ? notification.actionUrl 
              : `/notifications/ambiguous?notificationId=${notification.id}`}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary-hover transition-colors font-medium"
            onClick={handleActionClick}
          >
            Resolve Match
          </Link>
        </div>
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
