'use client'

import { NotificationType } from '@prisma/client'
import { Sparkles } from 'lucide-react'
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

interface NewJobDetectedNotificationProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
  onClose: () => void
}

export function NewJobDetectedNotification({
  notification,
  onMarkAsRead,
  onDismiss,
  onClose,
}: NewJobDetectedNotificationProps) {
  const handleCreateJob = async () => {
    try {
      const response = await fetch(`/api/notifications/${notification.id}/create-job`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.jobId) {
          window.location.href = `/jobs/${data.jobId}`
        } else {
          onMarkAsRead(notification.id)
          window.location.reload() // Refresh to update notification list
        }
        onClose()
      }
    } catch (error) {
      console.error('Error creating job:', error)
    }
  }

  return (
    <div
      className={`flex items-start gap-3 px-3 py-3 hover:bg-primary-lightest transition-colors text-sm border-b border-border last:border-0 ${
        !notification.isRead ? 'bg-primary-lightest/30' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <Sparkles className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleCreateJob}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary-hover transition-colors font-medium"
          >
            Create Job
          </button>
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
