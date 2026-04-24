'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Briefcase, FileText, Bot, Mail } from 'lucide-react'
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
  { name: 'Email sync', href: '/settings/integrations', icon: Mail },
  { name: 'Resume Advisor', href: '/resume-advisor', icon: FileText },
]

export function LeftSidebar() {
  const pathname = usePathname()
  const router = useRouter()

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
      <nav className="flex min-w-0 w-full max-w-full flex-col gap-1 pt-6 pr-0">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/')
          const isDisabled = item.disabled

          const labelClass = cn(
            'ms-0 min-w-0 overflow-hidden whitespace-nowrap text-sm font-medium',
            'max-w-0 opacity-0',
            'transition-[max-width,opacity] duration-300 ease-[var(--ease-ios)]',
            'group-hover:max-w-[10rem] group-hover:opacity-100'
          )

          if (isDisabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  'relative flex w-full min-w-0 items-center py-2.5 pr-2',
                  'cursor-not-allowed opacity-45'
                )}
                title={`${item.name} (Coming soon)`}
              >
                <div
                  className="relative flex min-h-9 w-16 shrink-0 items-center justify-center"
                  aria-hidden
                >
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <span className={cn(labelClass, 'text-muted-foreground')}>
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
                'relative flex w-full min-w-0 items-center py-2.5 pr-2',
                'transition-[background-color,color] duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
              )}
              title={item.name}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                />
              )}
              {/* Icon rail: same 64px box at all times — no horizontal shift on expand */}
              <div className="relative flex min-h-9 w-16 shrink-0 items-center justify-center">
                <Icon className="size-5 shrink-0" />
                {item.href === '/bot' && <BotQueueBadge />}
              </div>
              <span className={labelClass}>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
