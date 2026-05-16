import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { postAuthRedirectPath, profileFieldsFromAuthUser, safeAuthRedirectPath } from '@/lib/auth-callback'

type CookieToSet = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function createAuthCallbackClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for Supabase auth callback',
    )
  }

  const cookiesToSet: CookieToSet[] = []
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(nextCookies) {
        cookiesToSet.push(...nextCookies)
      },
    },
  })

  return {
    supabase,
    applyCookies(response: NextResponse) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    },
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const providerError = searchParams.get('error')
  const providerErrorDescription = searchParams.get('error_description')

  const redirectToLoginError = (
    error: string,
    applyCookies: (response: NextResponse) => NextResponse = (response) => response,
  ) => {
    const url = new URL('/login', origin)
    if (next) {
      url.searchParams.set('next', safeAuthRedirectPath(next))
    }
    url.searchParams.set('error', error)
    return applyCookies(NextResponse.redirect(url))
  }

  if (!code) {
    if (providerError) {
      console.error('Auth callback provider error:', {
        error: providerError,
        description: providerErrorDescription,
      })
      return redirectToLoginError('auth_failed')
    }

    return redirectToLoginError('missing_code')
  }

  let authCallbackClient: ReturnType<typeof createAuthCallbackClient>
  try {
    authCallbackClient = createAuthCallbackClient(request)
  } catch (error) {
    console.error('Auth callback Supabase client error:', error)
    return redirectToLoginError('auth_not_configured')
  }

  const { supabase, applyCookies } = authCallbackClient
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('Auth callback exchange failed:', error?.message ?? 'No user returned')
    return redirectToLoginError('auth_failed', applyCookies)
  }

  const user = data.user
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>

  try {
    const profileFields = profileFieldsFromAuthUser({
      id: user.id,
      email: user.email,
      metadata,
    })

    await prisma.profile.upsert({
      where: { id: user.id },
      create: profileFields,
      update: {
        email: profileFields.email,
        name: profileFields.name,
        avatarUrl: profileFields.avatarUrl,
      },
    })
  } catch (profileError) {
    console.error('Auth callback profile setup failed:', profileError)
    await supabase.auth.signOut()
    return redirectToLoginError('profile_setup_failed', applyCookies)
  }

  const hasCompletedOnboarding = metadata['onboarding_completed'] === true
  return applyCookies(
    NextResponse.redirect(
      new URL(postAuthRedirectPath({ next, hasCompletedOnboarding }), origin),
    ),
  )
}
