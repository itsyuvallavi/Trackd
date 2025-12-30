import { NextRequest, NextResponse } from 'next/server'

/**
 * Initiate OAuth flow for Google or Microsoft email integration
 * This creates an OAuth URL and redirects the user to authorize email access
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const provider = searchParams.get('provider') // 'google' or 'microsoft'
  const redirectTo = searchParams.get('redirect_to') || '/settings/integrations'

  if (!provider || !['google', 'microsoft'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  // Get base URL from environment variable or request origin
  // In production, NEXT_PUBLIC_APP_URL should be set in Vercel environment variables
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.NODE_ENV === 'production' 
      ? request.nextUrl.origin 
      : 'http://localhost:3000')
  const callbackUrl = `${baseUrl}/api/auth/email/oauth/callback`

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
    authUrl.searchParams.set(
      'state',
      JSON.stringify({ provider: 'google', redirectTo, userId: 'temp-user' }),
    )

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
    authUrl.searchParams.set(
      'state',
      JSON.stringify({ provider: 'microsoft', redirectTo, userId: 'temp-user' }),
    )

    return NextResponse.redirect(authUrl.toString())
  }

  return NextResponse.json({ error: 'Provider not implemented' }, { status: 400 })
}

