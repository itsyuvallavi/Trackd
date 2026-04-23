import { AppShell } from '@/components/layout/app-shell'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { updateProfile } from './actions'
import { ThemeSelector } from '@/components/profile/theme-selector'
import Link from 'next/link'
import { ArrowRight, Bot, Plug } from 'lucide-react'
import { getUserProfile, getEmailIntegration } from '@/lib/cached-queries'

export const revalidate = 0

export default async function ProfilePage() {
  const user = await requireAuth()

  const [profileData, emailIntegration] = await Promise.all([
    getUserProfile(user.id),
    getEmailIntegration(user.id),
  ])

  let profile = profileData
  if (!profile) {
    profile = await prisma.profile.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? '',
        name:
          (user.user_metadata as Record<string, unknown>)?.full_name?.toString() ??
          (user.user_metadata as Record<string, unknown>)?.name?.toString() ??
          null,
      },
      update: {},
    })
  }

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight mb-1">
              Profile
            </h1>
            <p className="text-sm text-muted-foreground">
              Your basic account details and appearance.
            </p>
          </header>

          <section className="glass glass-subtle rounded-2xl px-5 md:px-6 py-6 space-y-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Email
              </p>
              <p className="text-sm text-foreground">{profile.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Managed via Supabase Auth (Google or email&nbsp;/&nbsp;password).
              </p>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Theme
              </p>
              <ThemeSelector />
            </div>

            <form action={updateProfile} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={profile.name ?? ''}
                  className="w-full rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150"
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                  Avatar URL
                </label>
                <input
                  type="url"
                  name="avatarUrl"
                  defaultValue={profile.avatarUrl ?? ''}
                  className="w-full rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150"
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Shown in the header when set.
                </p>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-150 ease-[var(--ease-ios)] hover:bg-primary/90 active:scale-[0.99]"
              >
                Save changes
              </button>
            </form>
          </section>

          {/* Related pages — links, not duplicates. */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/settings/integrations"
              className="group glass glass-subtle rounded-2xl px-5 py-4 flex items-center gap-3 hover:bg-foreground/[0.02] transition-colors"
            >
              <Plug className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Integrations</p>
                <p className="text-xs text-muted-foreground">
                  Email sync, Chrome extension
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              href="/bot/identity"
              className="group glass glass-subtle rounded-2xl px-5 py-4 flex items-center gap-3 hover:bg-foreground/[0.02] transition-colors"
            >
              <Bot className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Application identity</p>
                <p className="text-xs text-muted-foreground">
                  Legal name, work auth used by the apply bot
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
