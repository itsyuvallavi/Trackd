import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/jobs'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user
      
      // Create Profile record if it doesn't exist (for new users)
      try {
        const existingProfile = await prisma.profile.findUnique({
          where: { id: user.id },
        })

        if (!existingProfile) {
          await prisma.profile.create({
            data: {
              id: user.id,
              email: user.email ?? '',
              name:
                (user.user_metadata as any)?.full_name ??
                (user.user_metadata as any)?.name ??
                (user.user_metadata as any)?.display_name ??
                null,
              avatarUrl: (user.user_metadata as any)?.avatar_url ?? null,
            },
          })
        }
      } catch (profileError) {
        console.error('Error creating profile:', profileError)
        // Continue even if profile creation fails - it will be created on first profile page visit
      }

      // Check if user has completed onboarding
      const hasCompletedOnboarding =
        user.user_metadata &&
        (user.user_metadata as Record<string, unknown>)['onboarding_completed'] === true

      // Redirect to onboarding if not completed, otherwise to the requested page
      const redirectTo = hasCompletedOnboarding ? next : '/onboarding'
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}


