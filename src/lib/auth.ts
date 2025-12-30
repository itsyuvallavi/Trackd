import { redirect } from 'next/navigation'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * Get current Supabase auth user on the server.
 * Returns null if no valid session.
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Require an authenticated user.
 * Redirects to /login if not authenticated.
 * Also ensures a Profile exists for the user.
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Ensure Profile exists (safety check after removing the trigger)
  try {
    const existingProfile = await prisma.profile.findUnique({
      where: { id: user.id },
    })

    if (!existingProfile) {
      await prisma.profile.create({
        data: {
          id: user.id,
          email: user.email ?? '',
          name:
            (user.user_metadata as any)?.full_name ??
            (user.user_metadata as any)?.name ??
            (user.user_metadata as any)?.display_name ??
            null,
          avatarUrl: (user.user_metadata as any)?.avatar_url ?? null,
        },
      })
    }
  } catch (error) {
    console.error('Error ensuring profile exists:', error)
    // Continue even if profile creation fails - non-blocking
  }

  return user
}


