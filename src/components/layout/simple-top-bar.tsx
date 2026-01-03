'use client'

import { CheckSquare } from 'lucide-react'
import Link from 'next/link'
import { UserProfileMenu } from '@/components/layout/user-profile-menu'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface SimpleTopBarProps {
  showEmailNotification?: boolean
}

export function SimpleTopBar({ showEmailNotification }: SimpleTopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border z-20">
      <div className="px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + App Name */}
          <Link href="/jobs" className="flex items-center gap-2 md:gap-2.5 hover:opacity-80 transition-opacity">
            <CheckSquare className="size-5 md:size-5 text-primary transition-colors" strokeWidth={2.5} />
            <span className="text-base md:text-lg font-semibold text-foreground">Trackd</span>
          </Link>

          {/* Right: Theme Toggle + Notification + User Profile */}
          <div className="flex items-center gap-2 md:gap-2.5">
            <ThemeToggle />
            <NotificationsBell showEmailNotification={showEmailNotification} />
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </div>
  )
}

