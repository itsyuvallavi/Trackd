'use client'

import { useEffect, useState } from 'react'

export function useBotQueueCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/bot/queue')
      .then((r) => {
        if (!r.ok) return { jobs: [] as unknown[] }
        return r.json() as Promise<{ jobs?: unknown[] }>
      })
      .then((d) => {
        if (!cancelled) setCount(d.jobs?.length ?? 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return count
}
