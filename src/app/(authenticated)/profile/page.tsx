import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { updateProfile } from './actions'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await requireAuth()

  let profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

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

  const emailIntegration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  return (
    <div className="size-full flex dark">
      <Sidebar />
      <SimpleTopBar showEmailNotification={!emailIntegration} />
      <div
        className="flex-1 flex flex-col bg-muted/10"
        style={{ marginLeft: '4rem' }}
      >
        <div className="flex-1 overflow-auto pt-[88px]">
          <div className="max-w-2xl mx-auto px-8 py-10">
          <h1 className="text-2xl font-semibold mb-2">Profile</h1>
          <p className="text-sm text-muted-foreground mb-8">
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
        </div>
      </div>
    </div>
  )
}


