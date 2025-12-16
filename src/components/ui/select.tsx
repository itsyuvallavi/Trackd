import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg'
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = 'md', children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          {
            'h-8 text-xs': size === 'sm',
            'h-10': size === 'md',
            'h-12 text-lg': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

// Simple wrappers for compatibility with the Figma example
const SelectTrigger = Select
const SelectValue = ({ children }: { children?: React.ReactNode }) => <>{children}</>
const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <option value={value}>{children}</option>
)

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
