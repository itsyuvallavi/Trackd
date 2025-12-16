'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface TooltipProps {
  children: React.ReactNode
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ children, content, side = 'bottom' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const offset = 8 // gap between trigger and tooltip

      let top = 0
      let left = 0

      switch (side) {
        case 'top':
          top = rect.top - offset
          left = rect.left + rect.width / 2
          break
        case 'bottom':
          top = rect.bottom + offset
          left = rect.left + rect.width / 2
          break
        case 'left':
          top = rect.top + rect.height / 2
          left = rect.left - offset
          break
        case 'right':
          top = rect.top + rect.height / 2
          left = rect.right + offset
          break
      }

      setPosition({ top, left })
    }
  }, [isVisible, side])

  const getTransformClasses = () => {
    switch (side) {
      case 'top':
        return '-translate-x-1/2 -translate-y-full'
      case 'bottom':
        return '-translate-x-1/2'
      case 'left':
        return '-translate-x-full -translate-y-1/2'
      case 'right':
        return '-translate-y-1/2'
      default:
        return ''
    }
  }

  const tooltipContent = isVisible && mounted ? (
    <div
      className={cn(
        'fixed z-[99999] px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md shadow-2xl whitespace-nowrap animate-in fade-in duration-150 pointer-events-none',
        getTransformClasses()
      )}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      {content}
      {/* Arrow */}
      <div
        className={cn(
          'absolute w-2 h-2 bg-gray-900 rotate-45',
          side === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
          side === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
          side === 'right' && 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
          side === 'left' && 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2'
        )}
      />
    </div>
  ) : null

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {mounted && tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  )
}
