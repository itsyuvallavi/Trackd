import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            // Primary: Blue emphasis button
            'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-blue': variant === 'primary',
            // Secondary: Subtle gray button
            'bg-muted text-foreground hover:bg-muted-foreground hover:text-background border border-border': variant === 'secondary',
            // Outline: Bordered button with blue hover
            'border border-border bg-card hover:bg-primary-lightest hover:text-primary hover:border-primary': variant === 'outline',
            // Ghost: Transparent with blue hover
            'hover:bg-primary-lightest hover:text-primary': variant === 'ghost',
            // Danger: Red for destructive actions
            'bg-error text-white hover:bg-error/90 shadow-sm': variant === 'danger',
          },
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button }
