import { prisma } from '@/lib/prisma'
import { EmailIntegrationForm } from '@/components/email/email-integration-form'
import { ExtensionKeySection } from '@/components/email/extension-key-section'
import { SyncHistory } from '@/components/email/sync-history'
import { AppShell } from '@/components/layout/app-shell'
import { requireAuth } from '@/lib/auth'
import { OAuthCallbackHandler } from '@/components/email/oauth-callback-handler'
import { serializeForClient } from '@/lib/serialize-for-client'

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

  const integrationForClient = integration
    ? serializeForClient(integration)
    : null

  return (
    <AppShell showEmailNotification={!integrationForClient}>
      <OAuthCallbackHandler />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold">Email Integration</h1>
              {integrationForClient && integrationForClient.isActive && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-foreground/60">Connected</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Manage your email integration and extension settings.
            </p>
            {integrationForClient && integrationForClient.isActive && (
              <div className="text-sm text-foreground/60 mb-4 space-y-1">
                <p>{integrationForClient.email}</p>
                {integrationForClient.autoSyncEnabled && (
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    Auto-sync: Every {integrationForClient.autoSyncFrequency} minutes
                  </p>
                )}
              </div>
            )}
            {integrationForClient?.lastError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                Error: {integrationForClient.lastError}
              </p>
            )}
        </div>

        <div className="space-y-6">
          {/* Email Integration Section */}
          <div className="border border-foreground/20 rounded-lg p-6 bg-card">
            <EmailIntegrationForm integration={integrationForClient} />
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
