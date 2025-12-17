import { NextResponse } from 'next/server'

/**
 * Debug endpoint to check OAuth configuration
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const callbackUrl = `${baseUrl}/api/auth/email/oauth/callback`
  
  return NextResponse.json({
    baseUrl,
    callbackUrl,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasMicrosoftClientId: !!process.env.MICROSOFT_CLIENT_ID,
    googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
    microsoftClientIdLength: process.env.MICROSOFT_CLIENT_ID?.length || 0,
    expectedRedirectUri: 'http://localhost:3000/api/auth/email/oauth/callback',
  })
}

