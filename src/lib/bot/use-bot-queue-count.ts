'use client'

import { useCallback, useEffect, useState } from 'react'
import { BOT_RUN_COMPLETE_EVENT } from '@/lib/constants'

const subscribers = new Set<(count: number) => void>()
let sharedCount = 0
let inFlightCountFetch: Promise<void> | null = null

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber(sharedCount))
}

function refetchSharedCount() {
  if (inFlightCountFetch) return inFlightCountFetch

  inFlightCountFetch = fetch('/api/bot/queue/count')
    .then((r) => {
      if (!r.ok) return { count: 0 }
      return r.json() as Promise<{ count?: number }>
    })
    .then((d) => {
      sharedCount = d.count ?? 0
      notifySubscribers()
    })
    .catch(() => {})
    .finally(() => {
      inFlightCountFetch = null
    })

  return inFlightCountFetch
}

export function useBotQueueCount(): number {
  const [count, setCount] = useState(sharedCount)

  const refetch = useCallback(() => {
    void refetchSharedCount()
  }, [])

  useEffect(() => {
    subscribers.add(setCount)
    refetch()
    return () => {
      subscribers.delete(setCount)
    }
  }, [refetch])

  useEffect(() => {
    const onRunComplete = () => refetch()
    window.addEventListener(BOT_RUN_COMPLETE_EVENT, onRunComplete)
    return () => window.removeEventListener(BOT_RUN_COMPLETE_EVENT, onRunComplete)
  }, [refetch])

  return count
}
