'use client'

import { useBotQueueCount } from '@/lib/bot/use-bot-queue-count'

export function BotQueueBadge() {
  const count = useBotQueueCount()

  if (!count) return null

  return (
    <span
      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums leading-none pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
