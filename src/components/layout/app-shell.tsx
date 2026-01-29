'use client'

import { SimpleTopBar } from './simple-top-bar'
import { LeftSidebar } from './left-sidebar'
import { FloatingFeedbackButton } from '@/components/feedback/floating-feedback-button'
import { NotificationsBell } from './notifications-bell'

interface AppShellProps {
  children: React.ReactNode
  showEmailNotification?: boolean
}

export function AppShell({ children, showEmailNotification }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SimpleTopBar 
        showEmailNotification={showEmailNotification}
      />

      {/* Mobile Notification Icon - Top Right */}
      <div className="fixed top-4 right-4 z-[9999] md:hidden safe-area-top">
        <NotificationsBell showEmailNotification={showEmailNotification} />
      </div>

      <div className="flex flex-1 relative">
        {/* Left Sidebar - Fixed, overlays content */}
        <LeftSidebar />

        {/* Main content area - no margin, sidebar overlays */}
        <main className="flex-1 flex flex-col relative z-0 pt-0 md:pt-[64px] pb-20 md:pb-0">
          {children}
        </main>
      </div>

      <FloatingFeedbackButton />
    </div>
  )
}
