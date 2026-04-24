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
    <header
      className="fixed inset-x-0 top-0 z-40 hidden md:block"
      aria-label="Top navigation"
    >
      <div className="glass glass-nav rounded-none border-x-0 border-t-0">
        <div className="h-14 flex items-center justify-between gap-4 px-4 md:px-6">
          <Link
            href="/jobs"
            className="flex items-center gap-2 min-w-0 transition-opacity duration-200 hover:opacity-80"
          >
            <Logo size={26} />
          </Link>

          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <NotificationsBell showEmailNotification={showEmailNotification} />
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
