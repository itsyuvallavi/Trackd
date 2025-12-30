import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmailProvider } from '@prisma/client'

/**
 * OAuth callback handler for email integration
 * Exchanges authorization code for access tokens and stores them
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateParam = searchParams.get('state')

  // Get base URL from environment variable or request origin
  // In production, NEXT_PUBLIC_APP_URL should be set in Vercel environment variables
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.NODE_ENV === 'production' 
      ? request.nextUrl.origin 
      : 'http://localhost:3000')
  
  // Helper to create absolute redirect URLs
  const createRedirectUrl = (path: string, params?: Record<string, string>) => {
    const url = new URL(path, baseUrl)
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

  let state
  try {
    state = JSON.parse(stateParam)
  } catch {
    return NextResponse.redirect(
      createRedirectUrl('/settings/integrations', { error: 'Invalid state parameter' })
    )
  }

  const { provider, redirectTo, userId } = state
  const callbackUrl = `${baseUrl}/api/auth/email/oauth/callback`

  try {
    if (provider === 'google') {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        console.error('Google token exchange failed:', error)
        return NextResponse.redirect(
          createRedirectUrl('/settings/integrations', { error: 'Failed to exchange authorization code' })
        )
      }

      const tokens = await tokenResponse.json()

      // Get user email from Google API
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const userInfo = await userInfoResponse.json()

      // Store integration
      await prisma.emailIntegration.upsert({
        where: { userId },
        create: {
          userId,
          provider: EmailProvider.GMAIL_OAUTH,
          email: userInfo.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          isActive: true,
        },
        update: {
          provider: EmailProvider.GMAIL_OAUTH,
          email: userInfo.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          isActive: true,
          lastError: null,
        },
      })

      const finalRedirect = redirectTo ? createRedirectUrl(redirectTo, { success: 'google_connected' }) : createRedirectUrl('/settings/integrations', { success: 'google_connected' })
      return NextResponse.redirect(finalRedirect)
    }

    if (provider === 'microsoft') {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID || '',
          client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
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

