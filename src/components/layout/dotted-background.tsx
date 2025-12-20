'use client'

import { cn } from '@/lib/utils'

export function DottedBackground() {
  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none z-0',
        '[background-size:20px_20px]',
        '[background-image:radial-gradient(#d4d4d4_1px,transparent_1px)]',
        'dark:[background-image:radial-gradient(#404040_1px,transparent_1px)]',
      )}
    />
  )
}
