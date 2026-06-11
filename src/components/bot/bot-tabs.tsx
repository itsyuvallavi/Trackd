'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, BriefcaseBusiness, Chrome, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBotQueueCount } from '@/lib/bot/use-bot-queue-count'

const tabs = [
  { href: '/bot', label: 'Queue', exact: true, icon: BriefcaseBusiness },
  { href: '/bot/setup', label: 'Setup', icon: Settings2 },
  { href: '/bot/extension', label: 'Browser extension', icon: Chrome },
  { href: '/bot/runs', label: 'Activity', icon: Activity },
]

export function BotTabs() {
  const pathname = usePathname() ?? ''
  const queueCount = useBotQueueCount()

  return (
    <nav
      aria-label="Bot sections"
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-card/50 p-1"
    >
      {tabs.map((t) => {
        const Icon = t.icon
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium',
              'text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.04] hover:text-foreground',
              active
                ? 'bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(74,222,128,0.22)]'
                : ''
            )}
          >
            <Icon className="size-4" />
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
