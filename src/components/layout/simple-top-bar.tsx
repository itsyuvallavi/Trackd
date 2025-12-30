'use client'

import { CheckSquare, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { UserProfileMenu } from '@/components/layout/user-profile-menu'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { AutoRefreshIndicator } from '@/components/layout/auto-refresh-indicator'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface SimpleTopBarProps {
  showEmailNotification?: boolean
}

export function SimpleTopBar({ showEmailNotification }: SimpleTopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm z-20">
      <div className="px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4 md:gap-6">
          {/* Left: Logo + App Name */}
          <div className="flex items-center gap-2 md:gap-3 group cursor-pointer">
            <CheckSquare className="size-5 md:size-6 text-primary transition-colors duration-200" strokeWidth={2.5} />
            <span className="text-lg md:text-xl font-semibold text-foreground">Trackd</span>
          </div>

          {/* Center: Search Bar - Hidden on mobile */}
          <div className="hidden md:block flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by company, role..."
              className="pl-9 h-10 bg-card border-border shadow-sm text-foreground placeholder:text-muted-foreground
                focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:border-primary transition-all duration-200"
            />
          </div>

          {/* Right: Theme Toggle + Auto-refresh + Notification + User Profile */}
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <AutoRefreshIndicator
              intervalSeconds={30}
              enabled={true}
              showTimer={false}
            />
            <NotificationsBell showEmailNotification={showEmailNotification} />
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </div>
  )
}

