/**
 * Shared cache-tag helpers for `unstable_cache` + `revalidateTag`.
 *
 * We use per-user tag scopes so mutations only invalidate the affected user's
 * reads, not every user's. Keep this file dependency-free so it can be
 * imported from both server actions and query helpers without cycles.
 */

export const cacheTagsFor = (userId: string) => ({
  jobs: `user:${userId}:jobs`,
  activity: `user:${userId}:activity`,
  notifications: `user:${userId}:notifications`,
  email: `user:${userId}:email`,
}) as const

export type UserCacheTags = ReturnType<typeof cacheTagsFor>
