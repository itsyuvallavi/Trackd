'use client'

import { NotificationType } from '@prisma/client'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Mark as read if needed (don't wait for it)
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
    
    // Close the dropdown
    onClose()
    
    // Let the anchor tag handle navigation naturally
    // Don't preventDefault - this ensures the link works even if JS fails
  }

  return (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 hover:bg-primary-lightest transition-colors border-b border-border last:border-0 ${
        !notification.isRead ? 'bg-primary-lightest/30' : ''
      }`}
      onClick={(e) => {
        // Don't close dropdown when clicking inside the notification
        e.stopPropagation()
      }}
    >
      <div className="mt-0.5 shrink-0">
        <Info className="size-4 text-info" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
          {notification.message}
        </p>
        <a
          href={notification.actionUrl || '/jobs'}
          onClick={handleActionClick}
          className="text-xs text-primary hover:underline mt-1 inline-block text-left cursor-pointer relative z-10"
        >
          View jobs →
        </a>
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
