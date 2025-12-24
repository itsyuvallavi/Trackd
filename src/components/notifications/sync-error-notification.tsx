'use client'

import { NotificationType } from '@prisma/client'
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

interface SyncErrorNotificationProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
  onClose: () => void
}

export function SyncErrorNotification({
  notification,
  onMarkAsRead,
  onDismiss,
  onClose,
}: SyncErrorNotificationProps) {
  return (
    <div
      className={`flex items-start gap-3 px-3 py-3 hover:bg-primary-lightest transition-colors text-sm border-b border-border last:border-0 ${
        !notification.isRead ? 'bg-primary-lightest/30' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <AlertCircle className="size-4 text-error" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
          {notification.message}
        </p>
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
