import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExtensionKeySection } from '@/components/bot/extension-key-section'

export const metadata = { title: 'Browser extension — Trackd Job Search' }

export default async function BotExtensionPage() {
  const user = await requireAuth()

  const extensionKey = await prisma.extensionKey.findUnique({
    where: { userId: user.id },
    select: {
      keyPrefix: true,
      lastUsedAt: true,
    },
  })

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Browser extension
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Trackd to job boards so you can save listings directly into your job search.
        </p>
      </div>
      <ExtensionKeySection
        initialData={
          extensionKey
            ? {
                keyPrefix: extensionKey.keyPrefix,
                lastUsedAt: extensionKey.lastUsedAt?.toISOString() || null,
              }
            : null
        }
      />
    </section>
  )
}
