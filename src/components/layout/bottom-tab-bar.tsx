'use client'

import { useState, useEffect, memo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBotQueueCount } from '@/lib/bot/use-bot-queue-count'
import { PRIMARY_NAV_ITEMS } from '@/components/layout/primary-nav'

export const BottomTabBar = memo(function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const queueCount = useBotQueueCount()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isProfileActive =
    pathname === '/profile' || pathname.startsWith('/profile/')

  if (!mounted) {
    return null
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-3 z-[9999] flex justify-center safe-area-bottom md:hidden"
      aria-label="Primary"
    >
      <div className="relative flex w-[min(calc(100vw-1.5rem),21rem)] items-center justify-between rounded-[1.65rem] border border-border/70 bg-background/88 px-2 py-2 shadow-[0_18px_60px_-24px_rgba(0,0,0,0.75)] backdrop-blur-2xl animate-in slide-in-from-bottom-2 fade-in duration-300">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => router.prefetch(item.href)}
              className={cn(
                'relative flex size-11 items-center justify-center rounded-2xl transition-[background-color,color,transform] duration-200 ease-[var(--ease-ios)]',
                'active:scale-[0.92]',
                active
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
              )}
              aria-label={item.name}
              title={item.name}
            >
              <div className="relative shrink-0">
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {item.href === '/bot' && queueCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4 h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tabular-nums leading-none">
                    {queueCount > 99 ? '99+' : queueCount}
                  </span>
                )}
              </div>
              {active && (
                <span
                  aria-hidden
                  className="absolute -bottom-1 h-1 w-1 rounded-full bg-current opacity-70"
                />
              )}
            </Link>
          )
        })}

        <Link
          href="/profile"
          onMouseEnter={() => router.prefetch('/profile')}
          className={cn(
            'relative flex size-11 shrink-0 items-center justify-center rounded-2xl',
            'transition-[background-color,color,transform] duration-200 ease-[var(--ease-ios)]',
            'active:scale-[0.92] hover:brightness-110',
            isProfileActive
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
          )}
          aria-label="Profile"
        >
          <User className="size-5" strokeWidth={2.2} />
          {isProfileActive && (
            <span
              aria-hidden
              className="absolute -bottom-1 h-1 w-1 rounded-full bg-current opacity-70"
            />
          )}
        </Link>
      </div>
    </nav>
  )
})
