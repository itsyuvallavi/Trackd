'use client'

import { useState, useEffect } from 'react'
import { Bell, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'
import { NotificationType } from '@prisma/client'
import { NotificationItem } from '@/components/notifications/notification-item'

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

interface NotificationsBellProps {
  showEmailNotification?: boolean
}

export function NotificationsBell({ showEmailNotification }: NotificationsBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Only fetch on mount - no polling to reduce server load
    fetchNotifications()
  }, [])

  // Refresh when dropdown is opened
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=20')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      })
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
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
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (!notifications.find(n => n.id === notificationId)?.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }


  const hasNotifications = unreadCount > 0 || notifications.length > 0 || showEmailNotification
  // Show red dot if there are unread notifications OR if email notification should be shown
  const showRedDot = unreadCount > 0 || showEmailNotification

  // Debug logging
  useEffect(() => {
    console.log('[NotificationsBell] Debug:', {
      showEmailNotification,
      unreadCount,
      showRedDot,
      notificationsCount: notifications.length
    })
  }, [showEmailNotification, unreadCount, showRedDot, notifications.length])

  return (
    <div className="relative">
      <Tooltip content="Notifications">
        <Button
          variant="ghost"
          size="sm"
          className="w-10 h-10 p-0 text-muted-foreground hover:text-primary hover:bg-primary-lightest transition-all duration-200 relative"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <Bell className="size-5" strokeWidth={2} />
          {showRedDot && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-error ring-2 ring-card" />
          )}
        </Button>
      </Tooltip>

      {isOpen && (
        <div className="fixed md:absolute right-4 md:right-0 top-[72px] md:top-auto md:mt-2 w-[calc(100vw-2rem)] max-w-96 rounded-lg border border-border bg-card shadow-lg z-30 py-2">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-base font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-sm px-2.5 py-1 rounded-full bg-error-bg text-error-text">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-auto">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                {showEmailNotification && (
                  <Link
                    href="/onboarding?step=email"
                    className="flex items-start gap-4 px-4 py-4 hover:bg-primary-lightest transition-colors text-base border-b border-border"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="mt-0.5">
                      <Mail className="size-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Set up email sync</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect your email to automatically track application updates.
                      </p>
                    </div>
                  </Link>
                )}

                {notifications.length === 0 && !showEmailNotification ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    You&apos;re all caught up.
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onDismiss={dismissNotification}
                      onClose={() => setIsOpen(false)}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


