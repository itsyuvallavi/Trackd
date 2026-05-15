import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'
import {
  createEmailOAuthState,
  type EmailOAuthProvider,
  safeEmailOAuthRedirectPath,
} from '@/lib/email-oauth-state'

/**
 * Initiate OAuth flow for Google or Microsoft email integration
 * This creates an OAuth URL and redirects the user to authorize email access
 */
export async function GET(request: NextRequest) {
  // Require authentication
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Get client IP for rate limiting (ip property only available in middleware)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
    request.headers.get('x-real-ip') || 
    'unknown'
  
  // Check auth rate limit (defense in depth - middleware also checks)
  const rateLimitResult = checkRateLimit(
    `auth:ip:${ip}`,
    RATE_LIMITS.auth.limit,
    RATE_LIMITS.auth.window
  )
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        message: 'Too many authentication attempts. Please try again later.',
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMITS.auth.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const provider = searchParams.get('provider') // 'google' or 'microsoft'
  const redirectTo = safeEmailOAuthRedirectPath(searchParams.get('redirect_to'))

  if (!provider || !['google', 'microsoft'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  let state: string
  try {
    state = createEmailOAuthState({
      provider: provider as EmailOAuthProvider,
      redirectTo,
      userId: user.id,
    })
  } catch (error) {
    console.error('Email OAuth state configuration error:', error)
    return NextResponse.json(
      { error: 'Email OAuth is not configured. Please set EMAIL_OAUTH_STATE_SECRET.' },
      { status: 500 },
    )
  }

  // Get base URL from environment variable or request origin
  // In production, NEXT_PUBLIC_APP_URL MUST be set to your production domain (e.g., https://trackd.app)
  // In development, it falls back to request origin (e.g., http://localhost:3001)
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  
  // Ensure baseUrl has a protocol (add https:// if missing)
  if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`
    console.log('[OAuth] Added https:// protocol to baseUrl:', baseUrl)
  }
  
  const callbackUrl = `${baseUrl}/api/auth/email/oauth/callback`
  
  // Log the callback URL for debugging (helpful to verify it matches OAuth app settings)
  console.log('[OAuth] Callback URL:', callbackUrl)
  console.log('[OAuth] Base URL source:', process.env.NEXT_PUBLIC_APP_URL ? `NEXT_PUBLIC_APP_URL env var: ${process.env.NEXT_PUBLIC_APP_URL}` : `request.nextUrl.origin: ${request.nextUrl.origin}`)
  console.log('[OAuth] Request origin:', request.nextUrl.origin)

  // For Google (Gmail)
  if (provider === 'google') {
    const googleClientId = process.env.GOOGLE_CLIENT_ID
    
    if (!googleClientId) {
      console.error('GOOGLE_CLIENT_ID is not set in environment variables')
      return NextResponse.json(
        { error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in your environment variables.' },
        { status: 500 }
      )
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', googleClientId)
    authUrl.searchParams.set('redirect_uri', callbackUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly email profile')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
  }

  // For Microsoft (Outlook)
  if (provider === 'microsoft') {
    const microsoftClientId = process.env.MICROSOFT_CLIENT_ID
    
    if (!microsoftClientId) {
      console.error('MICROSOFT_CLIENT_ID is not set in environment variables')
      return NextResponse.json(
        { error: 'Microsoft OAuth is not configured. Please set MICROSOFT_CLIENT_ID in your environment variables.' },
        { status: 500 }
      )
    }

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    authUrl.searchParams.set('client_id', microsoftClientId)
    authUrl.searchParams.set('redirect_uri', callbackUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'https://graph.microsoft.com/Mail.Read offline_access')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
  }

  return NextResponse.json({ error: 'Provider not implemented' }, { status: 400 })
}
