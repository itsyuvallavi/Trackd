'use client'

import Link from 'next/link'
import { UserProfileMenu } from '@/components/layout/user-profile-menu'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { Logo } from '@/components/ui/logo'

interface SimpleTopBarProps {
  showEmailNotification?: boolean
}

export function SimpleTopBar({ showEmailNotification }: SimpleTopBarProps) {

  return (
    <div className="fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border z-20 hidden md:block">
      <div className="px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + App Name */}
          <Link href="/jobs" className="hover:opacity-80 transition-opacity">
            <Logo size={28} />
          </Link>

          {/* Right: Notification + User Profile */}
          <div className="flex items-center gap-2 md:gap-2.5">
            <NotificationsBell showEmailNotification={showEmailNotification} />
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </div>
  )
}

