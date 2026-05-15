import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// Routes that require authentication
const protectedRoutes = ['/jobs', '/board', '/today', '/settings', '/onboarding', '/profile', '/notifications']

// Routes that should redirect to /jobs if already logged in
const authRoutes = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isApiRoute = path.startsWith('/api/')
  const isProtectedRoute = isRouteMatch(path, protectedRoutes)
  const isAuthRoute = isRouteMatch(path, authRoutes)
  const shouldAuthenticate = shouldAuthenticateInProxy(path)
  const { supabaseResponse, user } = await updateSession(request, {
    authenticate: shouldAuthenticate,
  })

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
  if (!isApiRoute) {
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

    if (user && !hasCompletedOnboarding && !isOnboardingRoute && !isApiRoute) {
      const onboardingUrl = new URL('/onboarding', request.url)
      return NextResponse.redirect(onboardingUrl)
    }

    if (isAuthRoute && user) {
      return NextResponse.redirect(new URL('/jobs', request.url))
    }

    return supabaseResponse
  }

  // API route handling - apply rate limiting
  return applyRateLimiting(request, supabaseResponse, user, path)
}

export function shouldAuthenticateInProxy(pathname: string): boolean {
  if (pathname.startsWith('/api/resume/upload')) {
    return true
  }

  if (pathname.startsWith('/api/')) {
    return false
  }

  return isRouteMatch(pathname, protectedRoutes) || isRouteMatch(pathname, authRoutes)
}

function isRouteMatch(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

/**
 * Apply rate limiting to API routes
 */
function applyRateLimiting(
  request: NextRequest,
  supabaseResponse: NextResponse,
  user: { id: string } | null,
  pathname: string
): NextResponse {
  // Get client IP address
  // Note: request.ip is available in middleware but TypeScript may not recognize it
  const ip = (request as NextRequest & { ip?: string }).ip ||
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
  // Extension endpoints - pre-auth throttle by IP before any route does key lookup.
  else if (pathname.startsWith('/api/extension/') || request.headers.has('X-Extension-Key')) {
    identifier = `extension:ip:${ip}`
    limitConfig = RATE_LIMITS.extension
  }
  // Auth endpoints - per IP
  else if (pathname.startsWith('/api/auth/')) {
    identifier = `auth:ip:${ip}`
    limitConfig = RATE_LIMITS.auth
  }
  // General API endpoints - per user or IP
  else {
    const sessionIdentifier = sessionRateLimitIdentifier(request)
    if (user) {
      identifier = `api:user:${user.id}`
    } else if (sessionIdentifier) {
      identifier = `api:session:${sessionIdentifier}`
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

export function sessionRateLimitIdentifier(request: NextRequest): string | null {
  const sessionCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'))

  if (!sessionCookie?.value) {
    return null
  }

  return stableHash(sessionCookie.value)
}

function stableHash(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
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
