import { prisma } from '@/lib/prisma'
import { EmailIntegrationForm } from '@/components/email/email-integration-form'
import { SyncHistory } from '@/components/email/sync-history'
import { AppShell } from '@/components/layout/app-shell'
import { requireAuth } from '@/lib/auth'
import { OAuthCallbackHandler } from '@/components/email/oauth-callback-handler'
import Link from 'next/link'

export const maxDuration = 300

export default async function IntegrationsPage() {
  const user = await requireAuth()

  const integration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      provider: true,
      email: true,
      imapHost: true,
      imapPort: true,
      imapUsername: true,
      isActive: true,
      lastSyncedAt: true,
      lastError: true,
      autoSyncEnabled: true,
      autoSyncFrequency: true,
      nextSyncAt: true,
    },
  })

  const integrationForClient = integration
    ? {
        ...integration,
        lastSyncedAt: integration.lastSyncedAt?.toISOString() ?? null,
        nextSyncAt: integration.nextSyncAt?.toISOString() ?? null,
      }
    : null

  return (
    <AppShell showEmailNotification={!integrationForClient}>
      <OAuthCallbackHandler />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-3xl font-semibold tracking-tight">
                Integrations
              </h1>
              {integrationForClient && integrationForClient.isActive && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-success"
                  />
                  Connected
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Manage mailbox sync and AI email findings.
            </p>
            <Link
              href="/settings/integrations/logs"
              className="inline-flex text-sm font-medium text-primary hover:text-primary/80 mb-4"
            >
              Review email sync log
            </Link>
            {integrationForClient && integrationForClient.isActive && (
              <div className="text-sm text-foreground/70 mb-2 space-y-1">
                <p>{integrationForClient.email}</p>
                {integrationForClient.autoSyncEnabled && (
                  <p className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-primary trackd-breath"
                    />
                    Auto-sync every {integrationForClient.autoSyncFrequency}{' '}
                    minutes
                  </p>
                )}
              </div>
            )}
            {integrationForClient?.lastError && (
              <p className="text-sm text-error-text mb-4">
                Error: {integrationForClient.lastError}
              </p>
            )}
          </div>

          <div className="space-y-5">
            <div className="glass glass-subtle rounded-2xl p-5 md:p-6">
              <EmailIntegrationForm integration={integrationForClient} />
            </div>
            <SyncHistory />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
