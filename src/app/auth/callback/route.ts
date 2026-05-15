import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { postAuthRedirectPath, profileFieldsFromAuthUser, safeAuthRedirectPath } from '@/lib/auth-callback'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const providerError = searchParams.get('error')
  const providerErrorDescription = searchParams.get('error_description')

  const redirectToLoginError = (error: string) => {
    const url = new URL('/login', origin)
    if (next) {
      url.searchParams.set('next', safeAuthRedirectPath(next))
    }
    url.searchParams.set('error', error)
    return NextResponse.redirect(url)
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

  let supabase
  try {
    supabase = await createClient()
  } catch (error) {
    console.error('Auth callback Supabase client error:', error)
    return redirectToLoginError('auth_not_configured')
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('Auth callback exchange failed:', error?.message ?? 'No user returned')
    return redirectToLoginError('auth_failed')
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
    return redirectToLoginError('profile_setup_failed')
  }

  const hasCompletedOnboarding = metadata['onboarding_completed'] === true
  return NextResponse.redirect(
    new URL(postAuthRedirectPath({ next, hasCompletedOnboarding }), origin),
  )
}
