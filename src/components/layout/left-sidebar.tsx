'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { Briefcase, FileText, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BotQueueBadge } from '@/components/bot/bot-queue-badge'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

const navItems: NavItem[] = [
  { name: 'Applications', href: '/jobs', icon: Briefcase },
  { name: 'Job Search', href: '/bot', icon: Bot },
  { name: 'Resume Advisor', href: '/resume-advisor', icon: FileText },
]

const ITEM_HEIGHT = 44 // row height in px (matches py-2.5 + icon size)
const ITEM_GAP = 4 // gap between rows in px

export function LeftSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const activeIndex = useMemo(() => {
    return navItems.findIndex((item) => {
      if (item.disabled) return false
      return pathname === item.href || pathname?.startsWith(item.href + '/')
    })
  }, [pathname])

  const indicatorTop =
    activeIndex >= 0
      ? activeIndex * (ITEM_HEIGHT + ITEM_GAP) + ITEM_HEIGHT / 2 - 10
      : -100

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col !fixed !left-0 top-14 bottom-0 z-30',
        /* `!fixed`: `.glass` sets `position: relative` and was winning, so the
           aside sat in the flex row; hover width 64→240px stole space from
           <main> and the whole list reflowed. */
        'w-16 hover:w-60',
        'transition-[width] duration-300 ease-[var(--ease-ios)]',
        'group overflow-y-auto overflow-x-hidden',
        'min-w-0',
        'glass glass-nav rounded-none border-y-0 border-l-0'
      )}
      aria-label="Primary"
    >
      <nav className="relative flex min-w-0 w-full max-w-full flex-col gap-1 px-2 pt-6">
        {/* Sliding active-indicator dot (offset matches nav pt-6) */}
        <span
          aria-hidden
          className={cn(
            'absolute left-0 w-[3px] h-5 rounded-r-full bg-primary',
            'transition-[top,opacity] duration-300 ease-[var(--ease-ios)]',
            activeIndex < 0 ? 'opacity-0' : 'opacity-100'
          )}
          style={{ top: `calc(1.5rem + ${indicatorTop}px)` }}
        />

        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/')
          const isDisabled = item.disabled

          if (isDisabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  'relative flex min-w-0 items-center gap-3 px-2.5 py-2.5 rounded-xl',
                  'cursor-not-allowed opacity-45'
                )}
                title={`${item.name} (Coming soon)`}
              >
                <Icon className="size-5 text-muted-foreground shrink-0" />
                <span
                  className={cn(
                    'text-sm font-medium text-muted-foreground whitespace-nowrap',
                    'min-w-0 max-w-0 overflow-hidden opacity-0',
                    'transition-[max-width,opacity] duration-200 ease-[var(--ease-ios)]',
                    'group-hover:max-w-[200px] group-hover:opacity-100'
                  )}
                >
                  {item.name}
                </span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => router.prefetch(item.href)}
              className={cn(
                'relative flex min-w-0 items-center gap-3 px-2.5 py-2.5 rounded-xl',
                'transition-colors duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
              )}
              title={item.name}
            >
              <Icon className="size-5 shrink-0" />
              <span
                className={cn(
                  'text-sm font-medium whitespace-nowrap',
                  'min-w-0 max-w-0 overflow-hidden opacity-0',
                  'transition-[max-width,opacity] duration-200 ease-[var(--ease-ios)]',
                  'group-hover:max-w-[200px] group-hover:opacity-100'
                )}
              >
                {item.name}
              </span>
              {item.href === '/bot' && <BotQueueBadge />}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
