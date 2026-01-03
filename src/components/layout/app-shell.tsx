'use client'

import { SimpleTopBar } from './simple-top-bar'
import { BottomTabBar } from './bottom-tab-bar'
import { LeftSidebar } from './left-sidebar'

interface AppShellProps {
  children: React.ReactNode
  showEmailNotification?: boolean
  sidebarOpen?: boolean
  onSidebarToggle?: (open: boolean) => void
}

export function AppShell({ children, showEmailNotification, sidebarOpen, onSidebarToggle }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SimpleTopBar 
        showEmailNotification={showEmailNotification}
        onDashboardToggle={onSidebarToggle ? () => onSidebarToggle(!sidebarOpen) : undefined}
        isDashboardOpen={sidebarOpen ?? false}
      />

      <div className="flex flex-1 relative">
        {/* Left Sidebar - Fixed, overlays content */}
        <LeftSidebar />

        {/* Main content area - no margin, sidebar overlays */}
        <main className="flex-1 flex flex-col relative z-0 pt-[56px] md:pt-[64px] pb-20 md:pb-0">
          {children}
        </main>
      </div>

      <BottomTabBar />
    </div>
  )
}
