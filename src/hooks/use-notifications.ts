'use client'

import useSWR from 'swr'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  metadata: unknown
  isRead: boolean
  actionUrl: string | null
  createdAt: string
}

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

interface UseNotificationsOptions {
  // Enable automatic polling (disabled by default to reduce server load)
  enablePolling?: boolean
  // Polling interval in milliseconds (default: 60 seconds)
  pollingInterval?: number
}

/**
 * SWR hook for fetching and caching notifications
 * Used for the notification bell to show instant counts
 * Polling is disabled by default to reduce database load
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enablePolling = false, pollingInterval = 60000 } = options
  
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    '/api/notifications',
    {
      // Only poll if explicitly enabled
      refreshInterval: enablePolling ? pollingInterval : 0,
      revalidateOnMount: true,
    }
  )

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    error,
    mutate,
  }
}

/**
 * Hook for just the unread count (lighter weight)
 * Polling is disabled by default to reduce database load
 */
export function useUnreadNotificationCount(options: UseNotificationsOptions = {}) {
  const { enablePolling = false, pollingInterval = 60000 } = options
  
  const { data, error, isLoading, mutate } = useSWR<{ count: number }>(
    '/api/notifications/count',
    {
      refreshInterval: enablePolling ? pollingInterval : 0,
      revalidateOnMount: true,
    }
  )

  return {
    count: data?.count ?? 0,
    isLoading,
    error,
    mutate,
  }
}

/**
 * Mark notification as read and update cache
 */
export async function markNotificationAsRead(
  mutate: ReturnType<typeof useNotifications>['mutate'],
  notificationId: string
) {
  // Optimistically update
  mutate(
    (currentData) => {
      if (!currentData) return currentData
      return {
        ...currentData,
        notifications: currentData.notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, currentData.unreadCount - 1),
      }
    },
    { revalidate: false }
  )

  try {
    await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    })
    mutate()
  } catch {
    mutate()
  }
}

