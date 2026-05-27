import { NotificationType, PrismaClient } from '@prisma/client'

type PrismaLike = Pick<PrismaClient, 'activity' | 'notification'>

function metadataEmailIdentifier(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }
  const value = (metadata as { emailIdentifier?: unknown }).emailIdentifier
  return typeof value === 'string' && value.trim() ? value : null
}

export async function getSeenEmailIdentifiers(
  prisma: PrismaLike,
  userId: string,
): Promise<Set<string>> {
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
  const [activities, notifications] = await Promise.all([
    prisma.activity.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      select: { metadata: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        type: {
          in: [
            NotificationType.AMBIGUOUS_MATCH,
            NotificationType.NEW_JOB_DETECTED,
            NotificationType.JOB_UPDATED,
            NotificationType.SYNC_ERROR,
          ],
        },
      },
      select: { metadata: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
  ])

  const seen = new Set<string>()
  for (const row of [...activities, ...notifications]) {
    const identifier = metadataEmailIdentifier(row.metadata)
    if (identifier) seen.add(identifier)
  }
  return seen
}
