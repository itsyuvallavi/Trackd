'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Briefcase, 
  Calendar, 
  Search, 
  MessageSquare,
  CheckSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

const navItems: NavItem[] = [
  {
    name: 'Applications',
    href: '/jobs',
    icon: Briefcase,
  },
  {
    name: 'Calendar',
    href: '/calendar',
    icon: Calendar,
  },
  {
    name: 'Job Search',
    href: '/search',
    icon: Search,
    disabled: true,
  },
  {
    name: 'Interview Prep',
    href: '/interview-prep',
    icon: MessageSquare,
  },
]

export function LeftSidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex fixed left-0 top-[64px] bottom-0 w-16 hover:w-[266px] border-r border-border bg-card z-30 flex-col py-4 gap-2 transition-all duration-300 ease-in-out group overflow-hidden">
      {/* Navigation items */}
      <nav className="flex flex-col gap-1 w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const isDisabled = item.disabled

          if (isDisabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  'relative flex items-center gap-3 p-3 rounded-lg transition-colors',
                  'cursor-not-allowed opacity-50'
                )}
                title={`${item.name} (Coming soon)`}
              >
                <Icon className="size-5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {item.name}
                </span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 p-3 rounded-lg transition-colors',
                'hover:bg-muted',
                isActive && 'bg-primary/10 text-primary',
                !isActive && 'text-muted-foreground hover:text-foreground'
              )}
              title={item.name}
            >
              <Icon className={cn(
                'size-5 shrink-0',
                isActive && 'text-primary'
              )} />
              <span className={cn(
                'text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                isActive && 'text-primary'
              )}>
                {item.name}
              </span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

