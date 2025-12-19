import { prisma } from '@/lib/prisma'
import { EmailIntegrationForm } from '@/components/email/email-integration-form'
import { ExtensionKeySection } from '@/components/email/extension-key-section'
import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { requireAuth } from '@/lib/auth'

export default async function IntegrationsPage() {
  const user = await requireAuth()

  const integration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  const extensionKey = await prisma.extensionKey.findUnique({
    where: { userId: user.id },
    select: {
      keyPrefix: true,
      lastUsedAt: true,
    }
  })

  return (
    <div className="size-full flex dark">
      <Sidebar />
      <SimpleTopBar showEmailNotification={!integration} />
      <div
        className="flex-1 flex flex-col bg-muted/10"
        style={{ marginLeft: '4rem' }}
      >
        <div className="flex-1 overflow-auto pt-[88px]">
          <div className="max-w-4xl mx-auto px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Email Integration</h1>
            {integration && integration.isActive && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-foreground/60">Connected</span>
              </div>
            )}
          </div>
          {integration && integration.isActive && (
            <p className="text-sm text-foreground/60 mt-1 ml-5">
              {integration.email}
            </p>
          )}
          {integration?.lastError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Error: {integration.lastError}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Email Integration Section */}
          <div className="border border-foreground/20 rounded-lg p-6">
            <EmailIntegrationForm integration={integration} />
          </div>

          {/* Chrome Extension Section */}
          <ExtensionKeySection
            initialData={extensionKey ? {
              keyPrefix: extensionKey.keyPrefix,
              lastUsedAt: extensionKey.lastUsedAt?.toISOString() || null
            } : null}
          />
        </div>
        </div>
      </div>
    </div>
    </div>
  )
}
