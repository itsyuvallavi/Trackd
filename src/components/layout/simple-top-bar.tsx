'use client'

import { CheckSquare, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { UserProfileMenu } from '@/components/layout/user-profile-menu'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { AutoRefreshIndicator } from '@/components/layout/auto-refresh-indicator'

interface SimpleTopBarProps {
  showEmailNotification?: boolean
}

export function SimpleTopBar({ showEmailNotification }: SimpleTopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm z-20">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Logo + App Name */}
          <div className="flex items-center gap-3">
            <CheckSquare className="size-6 text-foreground" strokeWidth={2.5} />
            <span className="text-xl font-semibold text-foreground">Trackd</span>
          </div>

          {/* Center: Search Bar (visual only for now) */}
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by company, role..."
              className="pl-9 h-10 bg-background border-border shadow-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Right: Auto-refresh + Notification + User Profile */}
          <div className="flex items-center gap-3">
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


