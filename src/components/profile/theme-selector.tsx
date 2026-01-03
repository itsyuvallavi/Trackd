'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark' | 'system'

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    setMounted(true)
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const initialTheme = savedTheme || 'system'
    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateSystemTheme = () => {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        setResolvedTheme(systemTheme)
        applyThemeDirectly(systemTheme)
      }
      
      updateSystemTheme()
      mediaQuery.addEventListener('change', updateSystemTheme)
      
      return () => {
        mediaQuery.removeEventListener('change', updateSystemTheme)
      }
    } else {
      // When not using system, ensure we apply the selected theme
      applyThemeDirectly(theme)
    }
  }, [theme])

  const applyThemeDirectly = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const applyTheme = (newTheme: Theme) => {
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      setResolvedTheme(systemTheme)
      applyThemeDirectly(systemTheme)
      localStorage.removeItem('theme') // Remove to use system
    } else {
      setResolvedTheme(newTheme)
      applyThemeDirectly(newTheme)
      localStorage.setItem('theme', newTheme)
    }
  }

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={theme === 'light' ? 'default' : 'outline'}
        size="sm"
        className="h-8 px-3 gap-1.5"
        onClick={() => handleThemeChange('light')}
      >
        <Sun className="size-3.5" />
        <span className="text-xs">Light</span>
      </Button>

      <Button
        variant={theme === 'dark' ? 'default' : 'outline'}
        size="sm"
        className="h-8 px-3 gap-1.5"
        onClick={() => handleThemeChange('dark')}
      >
        <Moon className="size-3.5" />
        <span className="text-xs">Dark</span>
      </Button>

      <Button
        variant={theme === 'system' ? 'default' : 'outline'}
        size="sm"
        className="h-8 px-3 gap-1.5"
        onClick={() => handleThemeChange('system')}
      >
        <Monitor className="size-3.5" />
        <span className="text-xs">System</span>
      </Button>
    </div>
  )
}

