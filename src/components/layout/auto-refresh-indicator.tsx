'use client'

import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tooltip } from '@/components/ui/tooltip'

interface AutoRefreshIndicatorProps {
  /**
   * Refresh interval in seconds
   * @default 30
   */
  intervalSeconds?: number
  
  /**
   * Whether auto-refresh is enabled
   * @default true
   */
  enabled?: boolean
  
  /**
   * Show countdown timer
   * @default false
   */
  showTimer?: boolean
}

export function AutoRefreshIndicator({ 
  intervalSeconds = 30,
  enabled = true,
  showTimer = false
}: AutoRefreshIndicatorProps) {
  const router = useRouter()
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(intervalSeconds)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!enabled) return

    // Countdown timer
    const countdown = setInterval(() => {
      setTimeUntilRefresh((prev) => {
        if (prev <= 1) {
          return intervalSeconds
        }
        return prev - 1
      })
    }, 1000)

    // Auto-refresh trigger
    const refresh = setInterval(() => {
      setIsRefreshing(true)
      router.refresh()
      
      // Reset animation after a short delay
      setTimeout(() => {
        setIsRefreshing(false)
      }, 1000)
    }, intervalSeconds * 1000)

    return () => {
      clearInterval(countdown)
      clearInterval(refresh)
    }
  }, [enabled, intervalSeconds, router])

  if (!enabled) return null

  const tooltipContent = `Auto-refreshing in ${timeUntilRefresh}s`

  return (
    <Tooltip content={tooltipContent} delayMs={0}>
      <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
        {/* Refresh Icon with Spin Animation */}
        <RefreshCw 
          className={`size-4 transition-all duration-500 ${
            isRefreshing 
              ? 'animate-spin text-primary' 
              : 'text-muted-foreground hover:text-primary'
          }`}
        />
        
        {/* Countdown Timer (optional) */}
        {showTimer && (
          <span className="text-xs tabular-nums">
            {timeUntilRefresh}s
          </span>
        )}
        
        {/* Pulse animation when refreshing */}
        {isRefreshing && (
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        )}
      </div>
    </Tooltip>
  )
}
