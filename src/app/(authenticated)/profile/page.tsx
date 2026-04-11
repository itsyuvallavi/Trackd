import { AppShell } from '@/components/layout/app-shell'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { updateProfile } from './actions'
import { ThemeSelector } from '@/components/profile/theme-selector'
import { EmailIntegrationForm } from '@/components/email/email-integration-form'
import { ExtensionKeySection } from '@/components/email/extension-key-section'
import { SyncHistory } from '@/components/email/sync-history'
import { ApplicationProfileForm } from '@/components/profile/application-profile-form'
import Link from 'next/link'
import { getUserProfile, getEmailIntegration, getExtensionKey } from '@/lib/cached-queries'

export const revalidate = 0

export default async function ProfilePage() {
  const user = await requireAuth()

  // Fetch all data in parallel using cached queries
  const [profileData, emailIntegration, extensionKey, appProfile] = await Promise.all([
    getUserProfile(user.id),
    getEmailIntegration(user.id),
    getExtensionKey(user.id),
    prisma.applicationProfile.findUnique({ where: { userId: user.id } }),
  ])

  // Create profile if it doesn't exist
  let profile = profileData
  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        id: user.id,
        email: user.email ?? '',
        name:
          (user.user_metadata as any)?.full_name ??
          (user.user_metadata as any)?.name ??
          null,
      },
    })
  }

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-4 md:py-10">
          {/* Profile Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-2">Profile</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Manage your basic account details.
            </p>

            <div className="rounded-xl border border-border bg-card/80 backdrop-blur px-6 py-6 space-y-6 shadow-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                  Email
                </p>
                <p className="text-sm text-foreground">{profile.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Email is managed via Supabase Auth (Google or email/password).
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Theme
                </p>
                <ThemeSelector />
              </div>

              <form action={updateProfile} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={profile.name ?? ''}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    name="avatarUrl"
                    defaultValue={profile.avatarUrl ?? ''}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. If set, this can be used to show your avatar in the
                    header.
                  </p>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Save changes
                </button>
              </form>
            </div>
          </div>

          {/* Application Profile Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Application Profile</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Used by the bot to automatically fill job application forms — contact details, work authorization, salary expectations, and more.
            </p>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur px-6 py-6 shadow-sm">
              <ApplicationProfileForm profile={appProfile} />
            </div>
          </div>

          {/* Settings Section - Visible on mobile, hidden on desktop (use desktop link instead) */}
          <div className="md:hidden">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">Settings</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Manage your email integration and extension settings.
              </p>
            </div>

            <div className="space-y-6">
              {/* Email Integration Section */}
              <div className="border border-foreground/20 rounded-lg p-6 bg-card">
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">Email Integration</h3>
                    {emailIntegration && emailIntegration.isActive && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm text-foreground/60">Connected</span>
                      </div>
                    )}
                  </div>
                  {emailIntegration && emailIntegration.isActive && (
                    <div className="text-sm text-foreground/60 space-y-1">
                      <p>{emailIntegration.email}</p>
                      {emailIntegration.autoSyncEnabled && (
                        <p className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                          Auto-sync: Every {emailIntegration.autoSyncFrequency} minutes
                        </p>
                      )}
                    </div>
                  )}
                  {emailIntegration?.lastError && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      Error: {emailIntegration.lastError}
                    </p>
                  )}
                </div>
                <EmailIntegrationForm integration={emailIntegration} />
              </div>

              {/* Chrome Extension Section */}
              <ExtensionKeySection
                initialData={extensionKey ? {
                  keyPrefix: extensionKey.keyPrefix,
                  lastUsedAt: extensionKey.lastUsedAt?.toISOString() || null
                } : null}
              />

              {/* Sync History Section */}
              <SyncHistory />
            </div>
          </div>

          {/* Desktop: Link to full settings page */}
          <div className="hidden md:block mt-8">
            <Link
              href="/settings/integrations"
              className="text-sm text-primary hover:underline"
            >
              View all settings →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}


