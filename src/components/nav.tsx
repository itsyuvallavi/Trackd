'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/jobs', label: 'All Jobs' },
  { href: '/today', label: 'Today' },
  { href: '/board', label: 'Board' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-foreground/10 bg-background">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold">
              Job Tracker
            </Link>
            <div className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/jobs/new-url"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add from URL
            </Link>
            <Link
              href="/settings/integrations"
              className="text-sm text-foreground/60 hover:text-foreground"
            >
              ⚙️ Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
