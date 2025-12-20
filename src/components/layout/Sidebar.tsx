'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  Kanban,
  FolderOpen,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

export function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { href: '/today', icon: LayoutGrid, label: 'Today' },
    { href: '/jobs', icon: FolderOpen, label: 'All Jobs' },
    { href: '/board', icon: Kanban, label: 'Board' },
  ]

  return (
    <aside
      className={cn(
        'bg-card border-r-2 border-border flex flex-col py-4 fixed left-0 top-[72px] h-[calc(100vh-72px)] w-16 shadow-xl z-20'
      )}
    >
      {/* Navigation Icons */}
      <nav className="flex flex-col gap-3 px-2 mt-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Tooltip key={item.href} content={item.label} side="right">
              <Link href={item.href}>
                <div
                  className={cn(
                    'relative rounded-lg transition-colors h-[44px] w-[44px] flex items-center justify-center',
                    'text-muted-foreground hover:text-foreground hover:bg-accent',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  <Icon className="size-5" />
                </div>
              </Link>
            </Tooltip>
          )
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="mt-auto px-2">
        <Tooltip content="Settings" side="right">
          <Link href="/settings/integrations">
            <div
              className={cn(
                'relative rounded-lg transition-colors h-[44px] w-[44px] flex items-center justify-center',
                'text-muted-foreground hover:text-foreground hover:bg-accent',
                pathname.startsWith('/settings') &&
                  'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Settings className="size-5" />
            </div>
          </Link>
        </Tooltip>
      </div>
    </aside>
  )
}
