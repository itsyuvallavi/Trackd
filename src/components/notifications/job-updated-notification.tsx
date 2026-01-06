'use client'

import { NotificationType } from '@prisma/client'
import Link from 'next/link'
import { CheckCircle2, X } from 'lucide-react'

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

interface JobUpdatedNotificationProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
  onClose: () => void
}

export function JobUpdatedNotification({
  notification,
  onMarkAsRead,
  onDismiss,
  onClose,
}: JobUpdatedNotificationProps) {
  const handleActionClick = () => {
    onClose()
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <div
      className={`flex items-start gap-4 px-4 py-4 hover:bg-primary-lightest transition-colors text-base border-b border-border last:border-0 ${
        !notification.isRead ? 'bg-primary-lightest/30' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <CheckCircle2 className="size-5 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{notification.title}</p>
        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
          {notification.message}
        </p>
        {notification.actionUrl && (
          <Link
            href={notification.actionUrl}
            className="text-sm text-primary hover:underline mt-1.5 inline-block"
            onClick={handleActionClick}
          >
            View job →
          </Link>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {!notification.isRead && (
          <button
            onClick={() => onMarkAsRead(notification.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Mark as read"
          >
            <CheckCircle2 className="size-5" />
          </button>
        )}
        <button
          onClick={(e) => onDismiss(notification.id, e)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Dismiss"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}
