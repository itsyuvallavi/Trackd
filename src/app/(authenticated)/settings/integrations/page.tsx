import { prisma } from '@/lib/prisma'
import { EmailIntegrationForm } from '@/components/email-integration-form'
import { SyncEmailsButton } from '@/components/sync-emails-button'

export default async function IntegrationsPage() {
  const userId = 'temp-user' // TODO: Replace with actual user ID from auth

  const integration = await prisma.emailIntegration.findUnique({
    where: { userId },
  })

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Email Integration</h1>
            <p className="text-foreground/60 mt-1">
              Connect your email to automatically track job application updates
            </p>
          </div>
          {integration && integration.isActive && (
            <SyncEmailsButton />
          )}
        </div>

        <div className="space-y-6">
          {/* Status Card */}
          {integration && (
            <div
              className={`border rounded-lg p-6 ${
                integration.isActive
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-foreground/20 bg-foreground/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {integration.isActive ? '✓ Connected' : '⚠ Disconnected'}
                  </h3>
                  <p className="text-sm text-foreground/60 mt-1">
                    {integration.email}
                  </p>
                  {integration.lastSyncedAt && (
                    <p className="text-sm text-foreground/60 mt-1">
                      Last synced:{' '}
                      {new Date(integration.lastSyncedAt).toLocaleString()}
                    </p>
                  )}
                  {integration.lastError && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Error: {integration.lastError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Configuration Card */}
          <div className="border border-foreground/20 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              {integration ? 'Update Configuration' : 'Setup Email Integration'}
            </h2>
            <p className="text-sm text-foreground/60 mb-6">
              We'll use IMAP to securely check your email for job-related messages.
              Your credentials are stored encrypted.
            </p>

            <EmailIntegrationForm integration={integration} />
          </div>

          {/* How it Works Card */}
          <div className="border border-foreground/20 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">How It Works</h2>
            <div className="space-y-3 text-sm text-foreground/80">
              <div className="flex gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold">1.</span>
                <p>
                  We periodically check your email for job-related messages from companies
                  and ATS systems (Greenhouse, Lever, etc.)
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold">2.</span>
                <p>
                  Emails are classified by type: application confirmations, interview
                  invites, rejections, or offers
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold">3.</span>
                <p>
                  We match emails to your existing jobs by company name and job title
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold">4.</span>
                <p>
                  Job statuses are automatically updated and activity is logged in the
                  timeline
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Card */}
          <div className="border border-foreground/20 rounded-lg p-6 bg-foreground/5">
            <h3 className="font-semibold mb-2">🔒 Privacy & Security</h3>
            <div className="text-sm text-foreground/70 space-y-2">
              <p>• Your email credentials are encrypted and never shared</p>
              <p>• We only read emails, never send or delete them</p>
              <p>• Email content is processed locally and not stored</p>
              <p>• You can disconnect at any time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
