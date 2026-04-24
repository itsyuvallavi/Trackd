'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'
import { NotificationItem } from '@/components/notifications/notification-item'
import { NOTIFICATIONS_REFRESH_EVENT } from '@/lib/constants'
import {
  useNotifications,
  type NotificationsResponse,
} from '@/hooks/use-notifications'

interface NotificationsBellProps {
  showEmailNotification?: boolean
}

export function NotificationsBell({ showEmailNotification }: NotificationsBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    isLoading,
    mutate,
  } = useNotifications({ limit: 20 })

  const fetchNotifications = useCallback(() => {
    return mutate()
  }, [mutate])

  // Refresh when dropdown is opened (SWR cache may be stale)
  useEffect(() => {
    if (isOpen) {
      void fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  useEffect(() => {
    const onRefresh = () => {
      void fetchNotifications()
    }
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh)
  }, [fetchNotifications])

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      })
      await mutate(
        (current) => {
          if (!current) return current
          return {
            ...current,
            notifications: current.notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, current.unreadCount - 1),
          }
        },
        { revalidate: false }
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
      await mutate()
    }
  }

  const dismissNotification = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const removed = notifications.find((n) => n.id === notificationId)
    if (!removed) return
    // Optimistic: API + revalidateTag can take a long time; don’t block the UI
    const prevSnapshot: NotificationsResponse = {
      notifications: [...notifications],
      unreadCount,
    }
    void mutate(
      (current) => {
        if (!current) return current
        return {
          ...current,
          notifications: current.notifications.filter(
            (n) => n.id !== notificationId
          ),
          unreadCount: !removed.isRead
            ? Math.max(0, current.unreadCount - 1)
            : current.unreadCount,
        }
      },
      { revalidate: false }
    )
    void (async () => {
      try {
        const res = await fetch(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Delete failed')
        await mutate()
      } catch (error) {
        console.error('Error dismissing notification:', error)
        await mutate(
          () => prevSnapshot,
          { revalidate: false }
        )
      }
    })()
  }

  const hasNotifications =
    unreadCount > 0 || notifications.length > 0 || showEmailNotification
  const showRedDot = unreadCount > 0 || showEmailNotification

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
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-error-bg text-error-text">
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
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-primary-lightest transition-colors border-b border-border"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="mt-0.5 shrink-0">
                      <Mail className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Set up email sync</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
                      notification={notification as never}
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
