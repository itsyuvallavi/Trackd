'use client'

import { useCallback, useEffect, useState } from 'react'
import { BOT_RUN_COMPLETE_EVENT } from '@/lib/constants'

export function useBotQueueCount(): number {
  const [count, setCount] = useState(0)

  const refetch = useCallback(() => {
    fetch('/api/bot/queue/count')
      .then((r) => {
        if (!r.ok) return { count: 0 }
        return r.json() as Promise<{ count?: number }>
      })
      .then((d) => {
        setCount(d.count ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    const onRunComplete = () => refetch()
    window.addEventListener(BOT_RUN_COMPLETE_EVENT, onRunComplete)
    return () => window.removeEventListener(BOT_RUN_COMPLETE_EVENT, onRunComplete)
  }, [refetch])

  return count
}
