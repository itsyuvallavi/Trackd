# OAuth Email Sync - Production Setup Guide

This guide explains how to configure Google and Microsoft OAuth for email sync to work with your production domain.

## Overview

The OAuth flow requires that the redirect URI (callback URL) used in the authorization request **exactly matches** what's registered in your OAuth app settings. The app uses `NEXT_PUBLIC_APP_URL` environment variable to construct the callback URL.

## Required Environment Variables

Add these to your production environment (e.g., Vercel Environment Variables):

```bash
# Your production domain (MUST be set for production)
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Google OAuth (required for Gmail sync)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft OAuth (required for Outlook sync)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API** for your project

### 2. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Configure:
   - **Name**: Trackd Email Sync (or your preferred name)
   - **Authorized JavaScript origins**: 
     - `https://yourdomain.com` (production)
     - `http://localhost:3001` (development - optional)
   - **Authorized redirect URIs**: 
     - `https://yourdomain.com/api/auth/email/oauth/callback` (production)
     - `http://localhost:3001/api/auth/email/oauth/callback` (development - optional)

### 3. Copy Credentials

- Copy the **Client ID** → Set as `GOOGLE_CLIENT_ID`
- Copy the **Client secret** → Set as `GOOGLE_CLIENT_SECRET`

### 4. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Fill in required information
3. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `email`
   - `profile`
4. Add test users (if in testing mode) or publish for production

## Microsoft OAuth Setup

### 1. Register an Azure App

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: Trackd Email Sync
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://yourdomain.com/api/auth/email/oauth/callback`

### 2. Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add:
   - `Mail.Read` (read user mail)
   - `offline_access` (refresh tokens)
4. Click **Grant admin consent** (if you're an admin)

### 3. Copy Credentials

1. Go to **Overview** → Copy the **Application (client) ID** → Set as `MICROSOFT_CLIENT_ID`
2. Go to **Certificates & secrets** → Create a new client secret → Copy the value → Set as `MICROSOFT_CLIENT_SECRET`
   - ⚠️ **Important**: Copy the secret value immediately - you won't be able to see it again!

## Verification Checklist

Before deploying to production, verify:

- [ ] `NEXT_PUBLIC_APP_URL` is set to your production domain (e.g., `https://trackd.app`)
- [ ] Google OAuth redirect URI is registered: `https://yourdomain.com/api/auth/email/oauth/callback`
- [ ] Microsoft OAuth redirect URI is registered: `https://yourdomain.com/api/auth/email/oauth/callback`
- [ ] All environment variables are set in your hosting platform (Vercel, etc.)
- [ ] OAuth consent screens are published/approved (for Google)
- [ ] API permissions are granted (for Microsoft)

## Testing

### Development Testing

In development, the app automatically uses `request.nextUrl.origin` if `NEXT_PUBLIC_APP_URL` is not set. This means:
- Local development: Uses `http://localhost:3001/api/auth/email/oauth/callback`
- Make sure this is registered in your OAuth apps for testing

### Production Testing

1. Deploy with all environment variables set
2. Try connecting Gmail/Outlook from the settings page
3. Check server logs if OAuth fails - the callback URL will be logged

## Troubleshooting

### "redirect_uri_mismatch" Error

This means the redirect URI doesn't match what's registered in your OAuth app.

**Solution:**
1. Check that `NEXT_PUBLIC_APP_URL` is set correctly in production
2. Verify the redirect URI in your OAuth app settings matches exactly:
   - `https://yourdomain.com/api/auth/email/oauth/callback`
   - No trailing slashes
   - Correct protocol (https)
   - Correct domain

### Callback URL Mismatch Between Environments

If you see errors about mismatched redirect URIs, check:
1. The callback URL is logged in development mode - check your server logs
2. The exact callback URL used is: `${NEXT_PUBLIC_APP_URL}/api/auth/email/oauth/callback`
3. This must match exactly what's in your OAuth app settings

### Missing Environment Variables

If OAuth fails silently or shows configuration errors:
1. Verify all environment variables are set in your hosting platform
2. Restart your application after setting environment variables
3. Check that variable names are correct (case-sensitive)

## Security Notes

- Never commit OAuth credentials to git
- Use environment variables for all secrets
- Regularly rotate client secrets
- Monitor OAuth usage in Google Cloud Console and Azure Portal
- Use HTTPS in production (required for OAuth)

## Support

If OAuth still doesn't work after following this guide:
1. Check server logs for the exact callback URL being used
2. Compare it with what's registered in your OAuth app
3. Ensure there are no typos or extra characters
4. Verify the domain matches exactly (including www vs non-www)

