'use client'

import { useState } from 'react'
import { Bell, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'

interface NotificationsBellProps {
  showEmailNotification?: boolean
}

export function NotificationsBell({ showEmailNotification }: NotificationsBellProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasNotifications = !!showEmailNotification

  return (
    <div className="relative">
      <Tooltip content="Notifications">
        <Button
          variant="ghost"
          size="sm"
          className="size-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary-lightest transition-all duration-200 relative"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <Bell className="size-5" />
          {hasNotifications && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-error ring-2 ring-card" />
          )}
        </Button>
      </Tooltip>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg z-30 py-2">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {hasNotifications && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-error-bg text-error-text">
                {1} new
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-auto">
            {showEmailNotification && (
              <Link
                href="/onboarding?step=email"
                className="flex items-start gap-3 px-3 py-3 hover:bg-primary-lightest transition-colors text-sm"
                onClick={() => setIsOpen(false)}
              >
                <div className="mt-0.5">
                  <Mail className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Set up email sync</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connect your email to automatically track application updates.
                  </p>
                </div>
              </Link>
            )}

            {!hasNotifications && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                You&apos;re all caught up.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


