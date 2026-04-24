import { redirect } from 'next/navigation'
import { cache } from 'react'
import { unstable_cache, revalidateTag } from 'next/cache'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheTagsFor } from '@/lib/cache-tags'

/**
 * Get current Supabase auth user on the server.
 * Returns null if no valid session.
 * 
 * Wrapped with React cache() to deduplicate calls within the same request.
 * This prevents multiple auth checks when multiple components need user data.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
})

/**
 * Cross-request: skip DB work if we already know a profile row exists.
 */
function profileRowExistsCache(userId: string) {
  return unstable_cache(
    async () => {
      const p = await prisma.profile.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      return p != null
    },
    ['profileRowExists', userId],
    {
      tags: [cacheTagsFor(userId).profileMeta],
      revalidate: 3600,
    },
  )()
}

/**
 * Ensure user profile exists in database.
 * Cached to prevent duplicate profile checks within same request.
 */
const ensureProfileExists = cache(
  async (userId: string, email: string, metadata: Record<string, unknown>) => {
  try {
    if (await profileRowExistsCache(userId)) {
      return
    }

    const existingProfile = await prisma.profile.findUnique({
      where: { id: userId }
    })

    if (existingProfile) {
      revalidateTag(cacheTagsFor(userId).profileMeta, { expire: 0 })
      return
    }

    // Check if there's an orphaned profile with this email (from deleted user)
    const orphanedProfile = await prisma.profile.findUnique({
      where: { email: email }
    })

    if (orphanedProfile) {
      await prisma.profile.delete({
        where: { id: orphanedProfile.id }
      })
    }

    // Create new profile
    await prisma.profile.create({
      data: {
        id: userId,
        email: email,
        name:
          (metadata?.full_name as string) ??
          (metadata?.name as string) ??
          (metadata?.display_name as string) ??
          null,
        avatarUrl: (metadata?.avatar_url as string) ?? null,
      },
    })

    revalidateTag(cacheTagsFor(userId).profileMeta, { expire: 0 })
    revalidateTag(cacheTagsFor(userId).profile, { expire: 0 })
  } catch (error) {
    console.error('Error ensuring profile exists:', error)
    // Continue even if profile creation fails - non-blocking
  }
})

/**
 * Require an authenticated user.
 * Redirects to /login if not authenticated.
 * Also ensures a Profile exists for the user.
 * 
 * Wrapped with React cache() to deduplicate calls within the same request.
 */
export const requireAuth = cache(async () => {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Ensure Profile exists (safety check after removing the trigger)
  await ensureProfileExists(
    user.id,
    user.email ?? '',
    (user.user_metadata as Record<string, unknown>) ?? {}
  )

  return user
})


