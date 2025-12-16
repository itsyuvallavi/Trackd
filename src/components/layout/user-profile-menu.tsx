'use client'

import { useState } from 'react'
import { User, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'

export function UserProfileMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="size-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base font-semibold transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] hover:scale-105"
      >
        YL
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
              <p className="text-sm font-medium text-foreground">Yuval Lavi</p>
              <p className="text-xs text-muted-foreground">info@yuvallavi.com</p>
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
                onClick={() => {
                  // Add logout logic here
                  setIsOpen(false)
                }}
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
