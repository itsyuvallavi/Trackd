'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderOpen, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/jobs', icon: FolderOpen, label: 'Jobs' },
  { href: '/settings/integrations', icon: Settings, label: 'Settings' },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href === '/settings/integrations' && pathname.startsWith('/settings'))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] px-3 py-2 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
