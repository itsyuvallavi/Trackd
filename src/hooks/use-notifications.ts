'use client'

import useSWR from 'swr'
import { NotificationType } from '@prisma/client'

export interface NotificationSWR {
  id: string
  type: NotificationType
  title: string
  message: string
  metadata: unknown
  isRead: boolean
  actionUrl: string | null
  createdAt: string
}

export interface NotificationsResponse {
  notifications: NotificationSWR[]
  unreadCount: number
}

interface UseNotificationsOptions {
  /** Must match the list fetch (default 20). */
  limit?: number
  /** Enable automatic polling (disabled by default to reduce server load) */
  enablePolling?: boolean
  /** Polling interval in milliseconds (default: 60 seconds) */
  pollingInterval?: number
}

/**
 * SWR hook for fetching and caching notifications (bell + list).
 * Polling is off by default.
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    limit = 20,
    enablePolling = false,
    pollingInterval = 60_000,
  } = options

  const key = `/api/notifications?limit=${limit}`

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<NotificationsResponse>(key, {
      refreshInterval: enablePolling ? pollingInterval : 0,
      revalidateOnMount: true,
    })

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    isValidating,
    error,
    mutate,
    key,
  }
}

/**
 * Hook for just the unread count (lighter weight separate endpoint).
 */
export function useUnreadNotificationCount(
  options: { enablePolling?: boolean; pollingInterval?: number } = {}
) {
  const { enablePolling = false, pollingInterval = 60_000 } = options

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
 * Mark notification as read and update SWR cache (optimistic).
 */
export async function markNotificationAsRead(
  mutate: ReturnType<typeof useNotifications>['mutate'],
  notificationId: string
) {
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

  try {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
    })
    if (!res.ok) throw new Error('PATCH failed')
    await mutate()
  } catch {
    await mutate()
  }
}
