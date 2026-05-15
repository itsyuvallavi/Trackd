import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmailProvider } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { safeEmailOAuthRedirectPath, verifyEmailOAuthState } from '@/lib/email-oauth-state'

/**
 * OAuth callback handler for email integration
 * Exchanges authorization code for access tokens and stores them
 */
export async function GET(request: NextRequest) {
  // Require authentication
  const user = await requireAuth()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateParam = searchParams.get('state')

  // Get base URL from environment variable or request origin
  // In production, NEXT_PUBLIC_APP_URL MUST be set to your production domain (e.g., https://trackd.app)
  // In development, it falls back to request origin (e.g., http://localhost:3001)
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  
  // Ensure baseUrl has a protocol (add https:// if missing)
  if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`
    console.log('[OAuth Callback] Added https:// protocol to baseUrl:', baseUrl)
  }
  
  const callbackUrl = `${baseUrl}/api/auth/email/oauth/callback`
  
  // Log the callback URL for debugging (helpful to verify it matches OAuth app settings)
  if (process.env.NODE_ENV === 'development') {
    console.log('[OAuth Callback] Received callback URL:', callbackUrl)
    console.log('[OAuth Callback] Base URL source:', process.env.NEXT_PUBLIC_APP_URL ? 'NEXT_PUBLIC_APP_URL env var' : 'request.nextUrl.origin')
    console.log('[OAuth Callback] Request origin:', request.nextUrl.origin)
  }
  
  // Helper to create absolute redirect URLs
  const createRedirectUrl = (path: string, params?: Record<string, string>) => {
    const url = new URL(safeEmailOAuthRedirectPath(path), baseUrl)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }
    return url.toString()
  }

  if (error) {
    return NextResponse.redirect(
      createRedirectUrl('/settings/integrations', { error })
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      createRedirectUrl('/settings/integrations', { error: 'Missing authorization code' })
    )
  }

  const verifiedState = verifyEmailOAuthState(stateParam)

  if (!verifiedState.ok) {
    return NextResponse.redirect(
      createRedirectUrl('/settings/integrations', { error: 'Invalid state parameter' })
    )
  }

  const { provider, redirectTo, userId: stateUserId } = verifiedState.payload
  
  // Verify that the userId in state matches the authenticated user
  // This prevents users from connecting OAuth to other users' accounts
  if (stateUserId !== user.id) {
    console.error('OAuth state userId mismatch:', { stateUserId, authenticatedUserId: user.id })
    return NextResponse.redirect(
      createRedirectUrl('/settings/integrations', { error: 'Authentication mismatch' })
    )
  }
  
  const userId = user.id

  try {
    if (provider === 'google') {
      // Validate required environment variables
      const googleClientId = process.env.GOOGLE_CLIENT_ID
      const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
      
      if (!googleClientId || !googleClientSecret) {
        console.error('Missing Google OAuth credentials:', { 
          hasClientId: !!googleClientId, 
          hasClientSecret: !!googleClientSecret 
        })
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables.' })
        )
      }

      // Exchange code for tokens
      // IMPORTANT: The redirect_uri MUST match exactly what was used in the authorization request
      // and what's registered in your Google OAuth app settings
      if (process.env.NODE_ENV === 'development') {
        console.log('[OAuth Callback] Using redirect_uri for token exchange:', callbackUrl)
      }
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        let errorMessage = 'Failed to exchange authorization code'
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error_description || errorJson.error || errorMessage
          console.error('Google token exchange failed:', errorJson)
        } catch {
          console.error('Google token exchange failed:', errorText)
        }
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: errorMessage })
        )
      }

      const tokens = await tokenResponse.json()

      if (!tokens.access_token) {
        console.error('No access token in Google OAuth response:', tokens)
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Failed to obtain access token' })
        )
      }

      // Get user email from Google API
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text()
        console.error('Failed to fetch user info from Google:', errorText)
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Failed to fetch user information' })
        )
      }

      const userInfo = await userInfoResponse.json()

      if (!userInfo.email) {
        console.error('No email in Google user info:', userInfo)
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Failed to get email address from Google' })
        )
      }

      // Store integration
      try {
        await prisma.emailIntegration.upsert({
          where: { userId },
          create: {
            userId,
            provider: EmailProvider.GMAIL_OAUTH,
            email: userInfo.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || null,
            tokenExpiry: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000)
              : null,
            isActive: true,
          },
          update: {
            provider: EmailProvider.GMAIL_OAUTH,
            email: userInfo.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || null,
            tokenExpiry: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000)
              : null,
            isActive: true,
            lastError: null,
          },
        })
      } catch (dbError) {
        console.error('Database error storing email integration:', dbError)
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Failed to save email integration' })
        )
      }

      const finalRedirect = redirectTo ? createRedirectUrl(redirectTo, { success: 'google_connected' }) : createRedirectUrl('/settings/integrations', { success: 'google_connected' })
      return NextResponse.redirect(finalRedirect)
    }

    if (provider === 'microsoft') {
      // Validate required environment variables
      const microsoftClientId = process.env.MICROSOFT_CLIENT_ID
      const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET
      
      if (!microsoftClientId || !microsoftClientSecret) {
        console.error('Missing Microsoft OAuth credentials:', { 
          hasClientId: !!microsoftClientId, 
          hasClientSecret: !!microsoftClientSecret 
        })
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Microsoft OAuth is not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in your environment variables.' })
        )
      }
      
      // Exchange code for tokens
      // IMPORTANT: The redirect_uri MUST match exactly what was used in the authorization request
      // and what's registered in your Microsoft Azure app settings
      if (process.env.NODE_ENV === 'development') {
        console.log('[OAuth Callback] Using redirect_uri for token exchange:', callbackUrl)
      }
      
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: microsoftClientId,
          client_secret: microsoftClientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        console.error('Microsoft token exchange failed:', error)
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Failed to exchange authorization code' })
        )
      }

      const tokens = await tokenResponse.json()

      // Get user email from Microsoft Graph API
      const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const userInfo = await userInfoResponse.json()

      // Store integration
      await prisma.emailIntegration.upsert({
        where: { userId },
        create: {
          userId,
          provider: EmailProvider.MICROSOFT_OAUTH,
          email: userInfo.mail || userInfo.userPrincipalName,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          isActive: true,
        },
        update: {
          provider: EmailProvider.MICROSOFT_OAUTH,
          email: userInfo.mail || userInfo.userPrincipalName,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          isActive: true,
          lastError: null,
        },
      })

      const finalRedirect = redirectTo ? createRedirectUrl(redirectTo, { success: 'microsoft_connected' }) : createRedirectUrl('/settings/integrations', { success: 'microsoft_connected' })
      return NextResponse.redirect(finalRedirect)
    }

    return NextResponse.redirect(
      createRedirectUrl('/settings/integrations', { error: 'Unknown provider' })
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      createRedirectUrl('/settings/integrations', { error: 'An error occurred during OAuth' })
    )
  }
}
