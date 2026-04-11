'use client'

import { useEffect, useState } from 'react'

export function useBotQueueCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/bot/queue')
      .then((r) => r.json())
      .then((d: { jobs?: unknown[] }) => {
        if (!cancelled) setCount(d.jobs?.length ?? 0)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return count
}
