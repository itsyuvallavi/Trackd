'use client'

import { ChevronDown } from 'lucide-react'
import { setupSelectClass, setupSelectCompactClass } from '@/components/bot/setup-ui'
import { cn } from '@/lib/utils'

type SetupSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  compact?: boolean
}

export function SetupSelect({
  className,
  children,
  disabled,
  compact = false,
  ...props
}: SetupSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        className={cn(
          compact ? setupSelectCompactClass : setupSelectClass,
          disabled && 'cursor-not-allowed opacity-50'
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          compact ? 'right-2 size-3' : 'right-2.5 size-3.5'
        )}
        aria-hidden
      />
    </div>
  )
}
