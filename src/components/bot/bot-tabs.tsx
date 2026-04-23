'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useBotQueueCount } from '@/lib/bot/use-bot-queue-count'

const tabs = [
  { href: '/bot', label: 'Queue', exact: true },
  { href: '/bot/settings', label: 'Settings' },
  { href: '/bot/resumes', label: 'Resumes' },
  { href: '/bot/identity', label: 'Identity' },
  { href: '/bot/runs', label: 'Runs' },
]

export function BotTabs() {
  const pathname = usePathname() ?? ''
  const queueCount = useBotQueueCount()

  return (
    <nav
      aria-label="Bot sections"
      className="-mx-2 flex gap-0.5 overflow-x-auto overflow-y-hidden"
    >
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium',
              'transition-colors duration-150',
              active
                ? 'bg-foreground/[0.06] text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]'
            )}
          >
            {t.label}
            {t.href === '/bot' && queueCount > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/15 text-primary'
                )}
              >
                {queueCount > 99 ? '99+' : queueCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
