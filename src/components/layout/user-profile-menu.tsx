'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, Settings, LogOut, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FeedbackModal } from '@/components/feedback/feedback-modal'

export function UserProfileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [initials, setInitials] = useState<string>('..')
  const [displayName, setDisplayName] = useState<string>('Loading...')
  const [email, setEmail] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement>(null)

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    // Close on Escape key
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    setIsOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="size-9 md:size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center transition-colors hover:bg-primary/90"
      >
        <User className="size-4 md:size-4.5" />
      </button>

      {isOpen && (
        <>
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-xl z-50 py-2 animate-in slide-in-from-top-2 fade-in duration-200">
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

              <button
                onClick={() => {
                  setIsOpen(false)
                  setFeedbackModalOpen(true)
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
              >
                <MessageSquare className="size-4" />
                Report Issue
              </button>
            </div>

            {/* Logout */}
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 text-sm text-error-text hover:bg-accent transition-colors w-full text-left"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          </div>
        </>
      )}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        currentUrl={typeof window !== 'undefined' ? window.location.href : undefined}
      />
    </div>
  )
}
