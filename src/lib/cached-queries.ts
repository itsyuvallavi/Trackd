import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getPublicJobTableColumnNames } from '@/lib/prisma-job-columns'
import { cacheTagsFor } from '@/lib/cache-tags'

/**
 * Hot-path queries cached with `unstable_cache` (the Next 16 path for caching
 * without Cache Components). Results survive across requests and are surgically
 * invalidated via `revalidateTag(tag, { expire: 0 })` from server actions.
 *
 * Invalidation uses per-user tags (see `cache-tags.ts`) so one user's mutation
 * never purges another user's hot data.
 */

const ONE_MINUTE = 60

/**
 * Cached query for email integration.
 * Fetched on almost every authenticated page and changes rarely, so a long
 * revalidate window is safe — mutations invalidate the tag explicitly.
 */
export const getEmailIntegration = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.emailIntegration.findUnique({
        where: { userId },
      }),
    ['getEmailIntegration', userId],
    {
      tags: [cacheTagsFor(userId).email],
      revalidate: 5 * ONE_MINUTE,
    },
  )()

/** Cached user profile. */
export const getUserProfile = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.profile.findUnique({
        where: { id: userId },
      }),
    ['getUserProfile', userId],
    {
      tags: [`user:${userId}:profile`],
      revalidate: 5 * ONE_MINUTE,
    },
  )()

/** Cached extension key. */
export const getExtensionKey = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.extensionKey.findUnique({
        where: { userId },
        select: {
          keyPrefix: true,
          lastUsedAt: true,
        },
      }),
    ['getExtensionKey', userId],
    {
      tags: [`user:${userId}:extensionKey`],
      revalidate: 5 * ONE_MINUTE,
    },
  )()

/** Cached unread notification count — used by the notification bell. */
export const getUnreadNotificationCount = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ['getUnreadNotificationCount', userId],
    {
      tags: [cacheTagsFor(userId).notifications],
      revalidate: ONE_MINUTE,
    },
  )()

/** Cached recent notifications. */
export const getRecentNotifications = (userId: string, limit = 50) =>
  unstable_cache(
    async () =>
      prisma.notification.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          metadata: true,
          isRead: true,
          actionUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ['getRecentNotifications', userId, String(limit)],
    {
      tags: [cacheTagsFor(userId).notifications],
      revalidate: ONE_MINUTE,
    },
  )()

/** Cached recent activities. */
export const getRecentActivities = (userId: string, limit = 50) =>
  unstable_cache(
    async () =>
      prisma.activity.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          fromStatus: true,
          toStatus: true,
          description: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              title: true,
              company: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ['getRecentActivities', userId, String(limit)],
    {
      tags: [cacheTagsFor(userId).activity],
      revalidate: ONE_MINUTE,
    },
  )()

/**
 * Cached user jobs list. Most-accessed query — caching across requests is the
 * biggest single TTFB win in this module.
 */
export const getUserJobs = async (userId: string, limit = 100) => {
  // Column introspection result is memoized for the lifetime of the process,
  // so this is cheap and we want to perform it OUTSIDE the cached closure to
  // keep the cache key stable across cold/warm starts.
  const cols = await getPublicJobTableColumnNames()
  const hasImportSource = cols.has('importSource')
  const hasImportJobBoard = cols.has('importJobBoard')

  const baseSelect = {
    id: true,
    title: true,
    company: true,
    location: true,
    status: true,
    priority: true,
    source: true,
    tags: true,
    url: true,
    savedAt: true,
    appliedAt: true,
    interviewAt: true,
    nextAction: true,
    notes: true,
    salary: true,
    contactName: true,
    contactEmail: true,
    createdAt: true,
    updatedAt: true,
  } as const

  const select = {
    ...baseSelect,
    ...(hasImportSource ? { importSource: true as const } : {}),
    ...(hasImportJobBoard ? { importJobBoard: true as const } : {}),
  }

  return unstable_cache(
    async () => {
      const rows = await prisma.job.findMany({
        where: { userId },
        select,
        orderBy: { savedAt: 'desc' },
        take: limit,
      })

      return rows.map((r) => ({
        ...r,
        importSource: hasImportSource
          ? ((r as { importSource?: string | null }).importSource ?? null)
          : null,
        importJobBoard: hasImportJobBoard
          ? ((r as { importJobBoard?: string | null }).importJobBoard ?? null)
          : null,
      }))
    },
    [
      'getUserJobs',
      userId,
      String(limit),
      String(hasImportSource),
      String(hasImportJobBoard),
    ],
    {
      tags: [cacheTagsFor(userId).jobs],
      revalidate: ONE_MINUTE,
    },
  )()
}
