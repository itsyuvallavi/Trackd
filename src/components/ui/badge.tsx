import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        {
          // Default: Blue
          'bg-primary-light text-info-text border border-primary': variant === 'default',
          // Success: Green
          'bg-success-bg text-success-text border border-success/20': variant === 'success',
          // Warning: Orange/Yellow
          'bg-warning-bg text-warning-text border border-warning/20': variant === 'warning',
          // Error: Red
          'bg-error-bg text-error-text border border-error/20': variant === 'error',
          // Info: Blue (lighter)
          'bg-info-bg text-info-text border border-info/20': variant === 'info',
          // Secondary: Gray
          'bg-muted text-muted-foreground border border-border': variant === 'secondary',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
