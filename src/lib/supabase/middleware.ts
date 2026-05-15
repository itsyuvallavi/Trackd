import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(
  request: NextRequest,
  options: { authenticate?: boolean } = {},
) {
  let supabaseResponse = NextResponse.next({ request })
  const shouldAuthenticate = options.authenticate ?? true

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_API

  // If env vars are missing, return early without user authentication
  // This allows the app to build and deploy even without Supabase configured
  if (!url || !anonKey) {
    console.warn('Supabase env vars not configured - skipping authentication')
    return { supabaseResponse, user: null }
  }

  if (!shouldAuthenticate) {
    return { supabaseResponse, user: null }
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}

