import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApplicationProfileForm } from '@/components/profile/application-profile-form'

export const metadata = { title: 'Application identity — Trackd' }

export default async function BotIdentityPage() {
  const user = await requireAuth()

  const appProfile = await prisma.applicationProfile
    .findUnique({ where: { userId: user.id } })
    .catch((e) => {
      console.error('[bot/identity] applicationProfile:', e)
      return null
    })

  const appProfileForClient = appProfile
    ? (() => {
        const { portalSignupPassword: _omit, ...rest } = appProfile
        return {
          ...rest,
          hasPortalSignupPassword: Boolean(_omit),
        }
      })()
    : null

  return (
    <section>
      <header className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">
          Application identity
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Legal name, email, contact details, work authorization, and salary
          used by the apply bot. The bot never clicks the final &quot;Sign
          up&quot; — you confirm from the screenshot.
        </p>
      </header>
      <div className="glass glass-subtle rounded-2xl px-5 md:px-6 py-6">
        <ApplicationProfileForm profile={appProfileForClient} />
      </div>
    </section>
  )
}
