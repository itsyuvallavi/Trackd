import { prisma } from '@/lib/prisma'
import { EmailIntegrationForm } from '@/components/email/email-integration-form'
import { ExtensionKeySection } from '@/components/email/extension-key-section'
import { SyncHistory } from '@/components/email/sync-history'
import { AppShell } from '@/components/layout/app-shell'
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
    <AppShell showEmailNotification={!integration}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold">Email Integration</h1>
            {integration && integration.isActive && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-foreground/60">Connected</span>
              </div>
            )}
          </div>
          {integration && integration.isActive && (
            <div className="text-sm text-foreground/60 mt-1 ml-5 space-y-1">
              <p>{integration.email}</p>
              {integration.autoSyncEnabled && (
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  Auto-sync: Every {integration.autoSyncFrequency} minutes
                </p>
              )}
            </div>
          )}
          {integration?.lastError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Error: {integration.lastError}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Email Integration Section */}
          <div className="border border-foreground/20 rounded-lg p-6 bg-card">
            <EmailIntegrationForm integration={integration} />
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
      </div>
    </AppShell>
  )
}
