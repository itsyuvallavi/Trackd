'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
  /** Show only the icon without text */
  iconOnly?: boolean
}

/**
 * Trackd Logo Component
 * 
 * Displays the Trackd logo with optional text
 */
export function Logo({ size = 24, className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/logo-transparent.svg"
        alt="Trackd"
        width={size}
        height={size}
        className="shrink-0"
        priority
      />
      {!iconOnly && (
        <span className="text-base md:text-lg font-semibold text-foreground">
          Trackd
        </span>
      )}
    </div>
  )
}
