import { redirect } from 'next/navigation'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'

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
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return user
}


