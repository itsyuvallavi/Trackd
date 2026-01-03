'use client'

import { SimpleTopBar } from './simple-top-bar'
import { BottomTabBar } from './bottom-tab-bar'

interface AppShellProps {
  children: React.ReactNode
  showEmailNotification?: boolean
}

export function AppShell({ children, showEmailNotification }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SimpleTopBar showEmailNotification={showEmailNotification} />

      {/* Main content area */}
      <main className="flex-1 flex flex-col relative z-10 pt-[56px] md:pt-[64px] pb-20 md:pb-0">
        {children}
      </main>

      <BottomTabBar />
    </div>
  )
}
