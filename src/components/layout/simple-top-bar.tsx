'use client'

import { CheckSquare, Activity } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserProfileMenu } from '@/components/layout/user-profile-menu'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SimpleTopBarProps {
  showEmailNotification?: boolean
  onDashboardToggle?: () => void
  isDashboardOpen?: boolean
}

export function SimpleTopBar({ showEmailNotification, onDashboardToggle, isDashboardOpen }: SimpleTopBarProps) {
  const pathname = usePathname()
  const isDashboardPage = pathname === '/dashboard'

  return (
    <div className="fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border z-20 hidden md:block">
      <div className="px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + App Name */}
          <Link href="/jobs" className="flex items-center gap-2 md:gap-2.5 hover:opacity-80 transition-opacity">
            <CheckSquare className="size-5 md:size-5 text-primary transition-colors" strokeWidth={2.5} />
            <span className="text-base md:text-lg font-semibold text-foreground">Trackd</span>
          </Link>

          {/* Right: Dashboard Link + Notification + User Profile */}
          <div className="flex items-center gap-2 md:gap-2.5">
            {/* Mobile: Link to dashboard page, Desktop: Toggle sidebar */}
            {onDashboardToggle ? (
              <>
                <Link href="/dashboard" className="md:hidden">
                  <Tooltip content="Dashboard">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "size-9 p-0 transition-all duration-200",
                        isDashboardPage 
                          ? "text-primary bg-primary-lightest" 
                          : "text-muted-foreground hover:text-primary hover:bg-primary-lightest"
                      )}
                    >
                      <Activity className="size-5" />
                    </Button>
                  </Tooltip>
                </Link>
                <Tooltip content={isDashboardOpen ? 'Close dashboard' : 'Open dashboard'}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:flex size-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary-lightest transition-all duration-200"
                    onClick={onDashboardToggle}
                  >
                    <Activity className="size-5" />
                  </Button>
                </Tooltip>
              </>
            ) : (
              <Link href="/dashboard">
                <Tooltip content="Dashboard">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "size-9 p-0 transition-all duration-200",
                      isDashboardPage 
                        ? "text-primary bg-primary-lightest" 
                        : "text-muted-foreground hover:text-primary hover:bg-primary-lightest"
                    )}
                  >
                    <Activity className="size-5" />
                  </Button>
                </Tooltip>
              </Link>
            )}
            <NotificationsBell showEmailNotification={showEmailNotification} />
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </div>
  )
}

