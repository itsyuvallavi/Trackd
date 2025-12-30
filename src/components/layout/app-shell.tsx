'use client'

import { Sidebar } from './Sidebar'
import { SimpleTopBar } from './simple-top-bar'
import { BottomTabBar } from './bottom-tab-bar'

interface AppShellProps {
  children: React.ReactNode
  showEmailNotification?: boolean
}

export function AppShell({ children, showEmailNotification }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar />
      <SimpleTopBar showEmailNotification={showEmailNotification} />

      {/* Main content area */}
      <main className="flex-1 flex flex-col relative z-10 pt-[64px] md:pt-[88px] pb-20 md:pb-0 md:ml-16">
        {children}
      </main>

      <BottomTabBar />
    </div>
  )
}
