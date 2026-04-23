import { getCurrentUser } from '@/lib/auth'
import { getEmailIntegration } from '@/lib/cached-queries'
import { AppShellClient } from './app-shell-client'

interface AppShellProps {
  children: React.ReactNode
  /**
   * When passed, callers control the email-setup banner themselves. When
   * omitted, the shell asks the (cross-request cached) email integration
   * helper and shows the banner when no integration exists.
   */
  showEmailNotification?: boolean
}

/**
 * Server-side shell. Hoisting the `emailIntegration` read here removes the
 * duplicate fetch every authed page used to do purely to drive the banner.
 * Because `getEmailIntegration` is now `unstable_cache`'d with a per-user tag,
 * the work is amortized across all authed pages.
 */
export async function AppShell({
  children,
  showEmailNotification,
}: AppShellProps) {
  let resolvedShowEmailNotification = showEmailNotification

  if (resolvedShowEmailNotification === undefined) {
    const user = await getCurrentUser()
    if (user) {
      const emailIntegration = await getEmailIntegration(user.id)
      resolvedShowEmailNotification = !emailIntegration
    }
  }

  return (
    <AppShellClient showEmailNotification={resolvedShowEmailNotification}>
      {children}
    </AppShellClient>
  )
}
