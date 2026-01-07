import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that require authentication
const protectedRoutes = ['/jobs', '/board', '/today', '/settings', '/onboarding', '/profile', '/notifications']

// Routes that should redirect to /jobs if already logged in
const authRoutes = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const path = request.nextUrl.pathname

  // If Supabase is not configured, allow all routes through
  // (this allows the app to deploy even without Supabase env vars)
  const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!supabaseConfigured) {
    return supabaseResponse
  }

  const isProtectedRoute = protectedRoutes.some((route) => path === route || path.startsWith(`${route}/`))
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', path)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is logged in but hasn't completed onboarding, redirect to onboarding
  const hasCompletedOnboarding =
    user?.user_metadata &&
    (user.user_metadata as Record<string, unknown>)['onboarding_completed'] === true

  const isOnboardingRoute = path === '/onboarding' || path.startsWith('/onboarding/')
  const isApiRoute = path.startsWith('/api/')

  if (user && !hasCompletedOnboarding && !isOnboardingRoute && !isApiRoute) {
    const onboardingUrl = new URL('/onboarding', request.url)
    return NextResponse.redirect(onboardingUrl)
  }

  const isAuthRoute = authRoutes.some((route) => path === route || path.startsWith(`${route}/`))
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/jobs', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


