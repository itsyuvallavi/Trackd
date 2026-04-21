import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getPublicJobTableColumnNames } from '@/lib/prisma-job-columns'

/**
 * Cached query for email integration
 * This is fetched on almost every authenticated page, so caching prevents duplicate queries
 */
export const getEmailIntegration = cache(async (userId: string) => {
  return prisma.emailIntegration.findUnique({
    where: { userId },
  })
})

/**
 * Cached query for user profile
 */
export const getUserProfile = cache(async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
  })
})

/**
 * Cached query for extension key
 */
export const getExtensionKey = cache(async (userId: string) => {
  return prisma.extensionKey.findUnique({
    where: { userId },
    select: {
      keyPrefix: true,
      lastUsedAt: true,
    }
  })
})

/**
 * Cached query for unread notification count
 * Useful for notification bell in header
 */
export const getUnreadNotificationCount = cache(async (userId: string) => {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })
})

/**
 * Cached query for recent notifications
 */
export const getRecentNotifications = cache(async (userId: string, limit = 50) => {
  return prisma.notification.findMany({
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
  })
})

/**
 * Cached query for recent activities
 */
export const getRecentActivities = cache(async (userId: string, limit = 50) => {
  return prisma.activity.findMany({
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
  })
})

/**
 * Cached query for user jobs
 * This is the most frequently accessed data, so caching significantly improves TTFB
 */
export const getUserJobs = cache(async (userId: string, limit = 100) => {
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

  const cols = await getPublicJobTableColumnNames()
  const select = {
    ...baseSelect,
    ...(cols.has('importSource') ? { importSource: true as const } : {}),
    ...(cols.has('importJobBoard') ? { importJobBoard: true as const } : {}),
  }

  const rows = await prisma.job.findMany({
    where: { userId },
    select,
    orderBy: { savedAt: 'desc' },
    take: limit,
  })

  return rows.map((r) => ({
    ...r,
    importSource: cols.has('importSource')
      ? ((r as { importSource?: string | null }).importSource ?? null)
      : null,
    importJobBoard: cols.has('importJobBoard')
      ? ((r as { importJobBoard?: string | null }).importJobBoard ?? null)
      : null,
  }))
})

