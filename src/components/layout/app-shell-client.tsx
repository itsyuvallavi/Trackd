'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { SimpleTopBar } from './simple-top-bar'
import { LeftSidebar } from './left-sidebar'
import { NotificationsBell } from './notifications-bell'

const FloatingFeedbackButton = dynamic(
  () =>
    import('@/components/feedback/floating-feedback-button').then((mod) => ({
      default: mod.FloatingFeedbackButton,
    })),
  { ssr: false }
)

const GlobalBotRunProgress = dynamic(
  () =>
    import('@/components/bot/global-bot-run-progress').then((mod) => ({
      default: mod.GlobalBotRunProgress,
    })),
  { ssr: false }
)

const GlobalEmailSyncProgress = dynamic(
  () =>
    import('@/components/email/global-email-sync-progress').then((mod) => ({
      default: mod.GlobalEmailSyncProgress,
    })),
  { ssr: false }
)

interface AppShellClientProps {
  children: React.ReactNode
  showEmailNotification?: boolean
}

export function AppShellClient({
  children,
  showEmailNotification,
}: AppShellClientProps) {
  const [showDeferredWidgets, setShowDeferredWidgets] = useState(false)

  useEffect(() => {
    const idleCallback =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(() => setShowDeferredWidgets(true), {
            timeout: 1500,
          })
        : window.setTimeout(() => setShowDeferredWidgets(true), 900)

    return () => {
      if (typeof idleCallback === 'number') {
        window.clearTimeout(idleCallback)
      } else if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallback)
      }
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SimpleTopBar showEmailNotification={showEmailNotification} />

      {/* Mobile notifications — positioned above the floating bottom tab */}
      <div className="fixed top-4 right-4 z-[9999] md:hidden safe-area-top">
        <NotificationsBell showEmailNotification={showEmailNotification} />
      </div>

      <div className="flex flex-1 relative">
        <LeftSidebar />

        {/*
          Symmetric horizontal padding (64px) reserves only the *collapsed* left
          nav strip on the left AND mirrors it on the right — this way inner
          content (`max-w-* mx-auto`) is dead-centered on the viewport instead
          of being shifted right by the fixed sidebar. The nav's hover expand
          (→240px) overlays content briefly; it no longer reflows layout.
        */}
        <main className="flex-1 flex flex-col relative z-0 pt-0 md:pt-[56px] md:px-16 pb-28 md:pb-0 min-h-[calc(100vh-56px)]">
          {children}
        </main>
      </div>

      {showDeferredWidgets && (
        <>
          <GlobalBotRunProgress />
          <GlobalEmailSyncProgress />
          <FloatingFeedbackButton />
        </>
      )}
    </div>
  )
}
