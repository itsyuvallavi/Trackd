'use client'

import { useState, useTransition } from 'react'
import { EmailIntegration } from '@prisma/client'
import { saveEmailIntegration, syncEmails, testEmailConnection } from '@/app/(authenticated)/settings/email-actions'
import { Button } from '@/components/ui/button'

interface EmailIntegrationFormProps {
  integration: EmailIntegration | null
}

export function EmailIntegrationForm({ integration }: EmailIntegrationFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isTesting, setIsTesting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showIMAPForm, setShowIMAPForm] = useState(!!integration)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleOAuthConnect = async (provider: 'google' | 'microsoft') => {
    try {
      const redirectTo = window.location.pathname
      const oauthUrl = `/api/auth/email/oauth?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`
      window.location.href = oauthUrl
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to initiate ${provider === 'google' ? 'Google' : 'Microsoft'} OAuth connection. Please try again.`
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await saveEmailIntegration(formData)

      if (result.success) {
        setMessage({ type: 'success', text: 'Email integration saved successfully!' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' })
      }
    })
  }

  const handleTest = async () => {
    setIsTesting(true)
    setMessage(null)

    try {
      const result = await testEmailConnection()

      if (result.success) {
        setMessage({ type: 'success', text: 'Connection successful!' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Connection failed' })
      }
    } finally {
      setIsTesting(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setMessage(null)

    try {
      const result = await syncEmails()

      if (result.success && result.stats) {
        setMessage({
          type: 'success',
          text: `Sync complete! Processed ${result.stats.processedEmails} emails, updated ${result.stats.updatedJobs} jobs.`,
        })
      } else {
        setMessage({ type: 'error', text: result.error || 'Sync failed' })
      }
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* OAuth Options (Primary - Recommended) */}
      {!integration && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold">Recommended</h3>
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                One-Click Setup
              </span>
            </div>
            <p className="text-sm text-foreground/60 mb-4">
              Connect with one click - no passwords needed
            </p>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={() => handleOAuthConnect('google')}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium">Connect with Google</span>
          </button>

          {/* Microsoft OAuth Button */}
          <button
            type="button"
            onClick={() => handleOAuthConnect('microsoft')}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <path fill="#f3f3f3" d="M0 0h23v23H0z" />
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span className="font-medium">Connect with Microsoft</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-foreground/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-foreground/60">Or use any email provider</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowIMAPForm(true)}
            className="w-full px-4 py-2 text-sm text-foreground/70 hover:text-foreground border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
          >
            Use IMAP (Custom Email)
          </button>
        </div>
      )}

      {/* IMAP Form (Fallback or when already configured) */}
      {(showIMAPForm || integration) && (
        <div>
          {!integration && (
            <div className="mb-4">
              <h3 className="font-semibold mb-1">IMAP Configuration</h3>
              <p className="text-sm text-foreground/60">
                For Zoho, ProtonMail, custom domains, or any email provider
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                defaultValue={integration?.email || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                placeholder="you@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="imapHost" className="block text-sm font-medium mb-1">
                  IMAP Host <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="imapHost"
                  name="imapHost"
                  required
                  defaultValue={integration?.imapHost || ''}
                  className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  placeholder="imap.example.com"
                />
              </div>

              <div>
                <label htmlFor="imapPort" className="block text-sm font-medium mb-1">
                  IMAP Port <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="imapPort"
                  name="imapPort"
                  required
                  defaultValue={integration?.imapPort || 993}
                  className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  placeholder="993"
                />
              </div>
            </div>

            <div>
              <label htmlFor="imapUsername" className="block text-sm font-medium mb-1">
                IMAP Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="imapUsername"
                name="imapUsername"
                required
                defaultValue={integration?.imapUsername || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                placeholder="Usually your email address"
              />
            </div>

            <div>
              <label htmlFor="imapPassword" className="block text-sm font-medium mb-1">
                IMAP Password / App Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="imapPassword"
                name="imapPassword"
                required
                defaultValue={integration?.imapPassword || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                placeholder="Your email password or app-specific password"
              />
              <p className="text-xs text-foreground/60 mt-1">
                💡 We recommend using an app-specific password for better security
              </p>
            </div>

            {message && (
              <div
                className={`rounded-md p-3 text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleTest}
                disabled={isTesting || isPending}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
              {integration && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSync}
                  disabled={isSyncing || isPending}
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
