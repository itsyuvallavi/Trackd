'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

/**
 * Hook to format relative time that only renders on client to avoid hydration mismatches
 * @param date - Date object or string
 * @returns Relative time string or empty string until hydrated
 */
export function useRelativeTime(date: Date | string | null | undefined): string {
  const [relativeTime, setRelativeTime] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    if (!date) return

    const updateRelativeTime = () => {
      setRelativeTime(formatDistanceToNow(new Date(date), { addSuffix: true }))
    }

    // Initial update
    updateRelativeTime()

    // Update every minute to keep it fresh
    const interval = setInterval(updateRelativeTime, 60000)

    return () => clearInterval(interval)
  }, [date])

  // Return empty string during SSR to avoid hydration mismatch
  if (!isMounted || !date) return ''

  return relativeTime
}
