# Google Sign-Up Auth Fix Plan

## Current Flow

- `/signup` calls `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: <origin>/auth/callback })`.
- `/auth/callback` exchanges the Supabase auth code, creates a `Profile` row when missing, then redirects new users to `/onboarding`.
- The middleware redirects authenticated users without `onboarding_completed` metadata to `/onboarding`.

## Most Likely Failure Causes

1. Supabase Google provider is not enabled or has the wrong Google OAuth credentials.
2. Google Cloud OAuth redirect URI does not include Supabase's callback URL:
   `https://<supabase-project-ref>.supabase.co/auth/v1/callback`.
3. Supabase Site URL / Additional Redirect URLs do not include the app callback:
   `https://trackd.app/auth/callback`, `https://trackd-eight.vercel.app/auth/callback`, and local dev `http://localhost:3001/auth/callback`.
4. `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing in the deployed environment, causing the client mock to return "Supabase not configured".
5. `DATABASE_URL` or Prisma connectivity fails during callback profile creation. The callback signs the user out and redirects to `/login?error=profile_setup_failed`.

## External Configuration To Verify

These cannot be fully proven by unit tests and must be checked in the live Google, Supabase, and deployment dashboards.

1. **Supabase Auth provider**
   - Supabase Dashboard -> Authentication -> Providers -> Google is enabled.
   - Google Client ID and Client Secret are the credentials for Trackd user sign-in.
   - Do not reuse the separate Gmail email-sync OAuth app unless it is intentionally configured for Supabase Auth.

2. **Google Cloud OAuth client**
   - The OAuth client type is Web application.
   - Authorized JavaScript origins include the app origins that start the flow, for example:
     - `https://trackd.app`
     - `https://trackd-eight.vercel.app`
     - `http://localhost:3001`
   - Authorized redirect URIs include Supabase's auth callback exactly:
     - `https://<supabase-project-ref>.supabase.co/auth/v1/callback`

3. **Supabase URL configuration**
   - Site URL is the canonical production app origin, for example `https://trackd.app`.
   - Additional Redirect URLs include every app callback origin that may be used by `redirectTo`:
     - `https://trackd.app/auth/callback`
     - `https://trackd-eight.vercel.app/auth/callback`
     - `http://localhost:3001/auth/callback`
   - Include Vercel preview callback URLs if testing signup from preview deployments.

4. **Runtime environment**
   - Deployed app has `NEXT_PUBLIC_SUPABASE_URL`.
   - Deployed app has `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Server runtime has `DATABASE_URL` and can reach the database for `Profile` upsert.
   - The deployed URL used by the browser matches a Supabase Additional Redirect URL exactly, including protocol, host, port, and path.

## Fix Steps

1. In Supabase Auth Providers, enable Google and verify the Client ID/Secret are for **user authentication**, not the separate Gmail email-sync OAuth app.
2. In Google Cloud Console, add exactly this Authorized redirect URI:
   `https://<supabase-project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Auth URL Configuration, set the production Site URL and add app callback redirects for production, preview, and localhost.
4. In Vercel/env, verify these variables exist: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL`.
5. Keep callback smoke tests with mocked Supabase + Prisma:
   successful code exchange creates or reuses `Profile`, new users redirect to `/onboarding`, configured users redirect only to safe local `next` paths, and failures redirect with stable error codes.
6. Add a signup UI test if a client component test harness is introduced:
   button passes `provider: 'google'` and redirect URL ending in `/auth/callback`.
7. Improve callback error reporting:
   include a stable `?error=auth_failed` reason for missing code, exchange failure, and profile-save failure; do not log tokens or OAuth codes.

## Verification

- New user: `/signup` -> Google -> `/auth/callback` -> `/onboarding`.
- Returning onboarded user: `/` or Google sign-in -> `/jobs`.
- Returning not-onboarded user: Google sign-in -> `/onboarding`.
- Failure case: bad provider config shows a clear login/signup error and does not create partial app data.
