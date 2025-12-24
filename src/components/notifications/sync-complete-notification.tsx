'use client'

import { NotificationType } from '@prisma/client'
import Link from 'next/link'
import { Info, CheckCircle2, X } from 'lucide-react'

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

interface SyncCompleteNotificationProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
  onClose: () => void
}

export function SyncCompleteNotification({
  notification,
  onMarkAsRead,
  onDismiss,
  onClose,
}: SyncCompleteNotificationProps) {
  const handleActionClick = () => {
    onClose()
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <div
      className={`flex items-start gap-3 px-3 py-3 hover:bg-primary-lightest transition-colors text-sm border-b border-border last:border-0 ${
        !notification.isRead ? 'bg-primary-lightest/30' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <Info className="size-4 text-info" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
          {notification.message}
        </p>
        {notification.actionUrl && (
          <Link
            href={notification.actionUrl}
            className="text-xs text-primary hover:underline mt-1 inline-block"
            onClick={handleActionClick}
          >
            View jobs →
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
