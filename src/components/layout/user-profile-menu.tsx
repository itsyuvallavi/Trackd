'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function UserProfileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [initials, setInitials] = useState<string>('..')
  const [displayName, setDisplayName] = useState<string>('Loading...')
  const [email, setEmail] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted || !user) return

      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        'User'

      const userEmail = user.email ?? ''

      const nameInitials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase())
        .join('') || 'U'

      setDisplayName(name)
      setEmail(userEmail)
      setInitials(nameInitials)
    }

    void loadUser()

    return () => {
      isMounted = false
    }
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    setIsOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="size-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base font-semibold transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] hover:scale-105"
      >
        {initials}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-xl z-30 py-2 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">
                {displayName}
              </p>
              {email && (
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              )}
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                href="/profile"
                className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <User className="size-4" />
                Profile
              </Link>

              <Link
                href="/settings/integrations"
                className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Settings className="size-4" />
                Settings
              </Link>
            </div>

            {/* Logout */}
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-accent transition-colors w-full text-left"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
