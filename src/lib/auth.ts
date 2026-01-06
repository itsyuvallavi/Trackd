import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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
 * Ensure user profile exists in database.
 * Cached to prevent duplicate profile checks within same request.
 */
const ensureProfileExists = cache(async (userId: string, email: string, metadata: Record<string, unknown>) => {
  try {
    const existingProfile = await prisma.profile.findUnique({
      where: { id: userId }
    })

    if (!existingProfile) {
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
    }
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


