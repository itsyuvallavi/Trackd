'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme')
    let initialTheme: 'light' | 'dark'
    if (savedTheme === 'light' || savedTheme === 'dark') {
      initialTheme = savedTheme
    } else if (savedTheme === 'system') {
      initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    } else {
      initialTheme = 'dark'
    }
    setTheme(initialTheme)
    // Do not call applyTheme here — the layout script already set the class, and
    // writing localStorage would clear a stored `system` preference.
  }, [])

  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-9 p-0"
        aria-label="Toggle theme"
      >
        <Sun className="size-4" />
      </Button>
    )
  }

  return (
    <Tooltip content={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary-lightest transition-all duration-200"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </Button>
    </Tooltip>
  )
}
