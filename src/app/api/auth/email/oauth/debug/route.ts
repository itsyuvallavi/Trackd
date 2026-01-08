import { NextRequest, NextResponse } from 'next/server'

/**
 * Debug endpoint to check what redirect URI would be used
 * Visit: /api/auth/email/oauth/debug
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const callbackUrl = `${baseUrl}/api/auth/email/oauth/callback`
  
  return NextResponse.json({
    message: 'OAuth Redirect URI Debug Info',
    callbackUrl,
    baseUrl,
    baseUrlSource: process.env.NEXT_PUBLIC_APP_URL ? 'NEXT_PUBLIC_APP_URL environment variable' : 'request.nextUrl.origin (fallback)',
    requestOrigin: request.nextUrl.origin,
    environmentVariables: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Not set',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Not set',
    },
    instructions: {
      google: `Add this EXACT redirect URI to your Google OAuth app: ${callbackUrl}`,
      microsoft: `Add this EXACT redirect URI to your Microsoft Azure app: ${callbackUrl}`,
    }
  }, { status: 200 })
}

