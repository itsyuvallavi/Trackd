'use client'

import { useState, memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, FileText, Plus, User, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QuickAddBar } from '@/components/jobs/quick-add-bar'
import { useBotQueueCount } from '@/lib/bot/use-bot-queue-count'

const navItems = [
  { href: '/jobs', icon: Briefcase, label: 'Jobs' },
  { href: '/resume-advisor', icon: FileText, label: 'Resume' },
  { href: '/bot/queue', icon: Bot, label: 'Queue' },
]

export const BottomTabBar = memo(function BottomTabBar() {
  const pathname = usePathname()
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const queueCount = useBotQueueCount()

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isProfileActive = pathname === '/profile' || pathname.startsWith('/profile/') || pathname.startsWith('/settings/')

  return (
    <>
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] safe-area-bottom md:hidden">
        <div className="relative flex items-center gap-1.5 bg-background/95 dark:bg-background/95 backdrop-blur-md border border-border rounded-full px-3 py-3 shadow-lg w-fit">
          {/* Plus Button - Left */}
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity shrink-0"
            aria-label="Quick add job"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </button>

          <div className="w-px h-7 bg-border mx-1 shrink-0" />

          {/* Navigation Items - Center */}
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 w-[90px]",
                  active 
                    ? "bg-foreground text-background" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <div className="relative shrink-0">
                  <Icon 
                    className="size-5" 
                    strokeWidth={active ? 2.5 : 2}
                  />
                  {item.href === '/bot/queue' && queueCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4 h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tabular-nums leading-none">
                      {queueCount > 99 ? '99+' : queueCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium transition-opacity whitespace-nowrap",
                  active ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          
          <div className="w-px h-7 bg-border mx-1 shrink-0" />
          
          {/* Profile Button - Right */}
          <Link
            href="/profile"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity shrink-0"
            aria-label="Profile"
          >
            <User className="size-5" strokeWidth={isProfileActive ? 2.5 : 2} />
          </Link>
        </div>
      </nav>

      <QuickAddBar 
        isOpen={isQuickAddOpen} 
        onClose={() => setIsQuickAddOpen(false)} 
      />
    </>
  )
})
