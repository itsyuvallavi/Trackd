import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

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
    // Still apply rate limiting to API routes even if Supabase isn't configured
    if (path.startsWith('/api/')) {
      return applyRateLimiting(request, supabaseResponse, null, path)
    }
    return supabaseResponse
  }

  // Handle route protection and redirects for non-API routes
  if (!path.startsWith('/api/')) {
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

  // API route handling - apply rate limiting
  return applyRateLimiting(request, supabaseResponse, user, path)
}

/**
 * Apply rate limiting to API routes
 */
function applyRateLimiting(
  request: NextRequest,
  supabaseResponse: NextResponse,
  user: any,
  pathname: string
): NextResponse {
  // Get client IP address
  // Note: request.ip is available in middleware but TypeScript may not recognize it
  const ip = (request as any).ip || 
    request.headers.get('x-forwarded-for')?.split(',')[0] || 
    request.headers.get('x-real-ip') || 
    'unknown'
  
  // Determine rate limit based on route
  let identifier: string
  let limitConfig: { limit: number; window: number }
  
  // File upload endpoints - per user
  if (pathname.startsWith('/api/resume/upload')) {
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    identifier = `upload:${user.id}`
    limitConfig = RATE_LIMITS.upload
  }
  // Extension endpoints - per extension key
  else if (pathname.startsWith('/api/extension/')) {
    const extensionKey = request.headers.get('X-Extension-Key')
    if (!extensionKey) {
      // If no key, rate limit by IP
      identifier = `extension:ip:${ip}`
      limitConfig = RATE_LIMITS.extension
    } else {
      // Rate limit by extension key
      identifier = `extension:key:${extensionKey}`
      limitConfig = RATE_LIMITS.extension
    }
  }
  // Auth endpoints - per IP
  else if (pathname.startsWith('/api/auth/')) {
    identifier = `auth:ip:${ip}`
    limitConfig = RATE_LIMITS.auth
  }
  // General API endpoints - per user or IP
  else {
    if (user) {
      identifier = `api:user:${user.id}`
    } else {
      identifier = `api:ip:${ip}`
    }
    limitConfig = RATE_LIMITS.api
  }
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(
    identifier,
    limitConfig.limit,
    limitConfig.window
  )
  
  // If rate limit exceeded, return 429
  if (!rateLimitResult.allowed) {
    const resetTime = new Date(rateLimitResult.resetAt).toISOString()
    
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again after ${resetTime}`,
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limitConfig.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        },
      }
    )
  }
  
  // Add rate limit headers to response
  // Clone the response to avoid mutating the original
  const response = new NextResponse(supabaseResponse.body, {
    status: supabaseResponse.status,
    statusText: supabaseResponse.statusText,
    headers: supabaseResponse.headers,
  })
  
  response.headers.set('X-RateLimit-Limit', limitConfig.limit.toString())
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
  response.headers.set('X-RateLimit-Reset', rateLimitResult.resetAt.toString())
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


