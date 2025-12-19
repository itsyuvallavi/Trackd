'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface SyncResultToastProps {
  isOpen: boolean
  onClose: () => void
  result: {
    type: 'success' | 'error'
    message: string
  } | null
  duration?: number
}

export function SyncResultToast({ isOpen, onClose, result, duration = 5000 }: SyncResultToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (isOpen && result) {
      // Small delay to trigger animation
      const showTimer = setTimeout(() => {
        setIsVisible(true)
        setIsExiting(false)
      }, 10)

      // Auto-dismiss after duration
      const dismissTimer = setTimeout(() => {
        setIsExiting(true)
        // Wait for exit animation to complete before calling onClose
        setTimeout(() => {
          setIsVisible(false)
          onClose()
        }, 300) // Match animation duration
      }, duration)

      return () => {
        clearTimeout(showTimer)
        clearTimeout(dismissTimer)
      }
    } else {
      setIsVisible(false)
      setIsExiting(false)
    }
  }, [isOpen, result, duration, onClose])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 300)
  }

  if (!isOpen || !result) return null

  const isSuccess = result.type === 'success'

  // Simplify the message - extract key info
  const getSimpleMessage = () => {
    if (!result.message) return ''
    
    const lines = result.message.split('\n')
    const stats = {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0
    }
    
    // Extract numbers from message
    lines.forEach(line => {
      const totalMatch = line.match(/Fetched (\d+)/)
      const processedMatch = line.match(/Processed (\d+)/)
      const createdMatch = line.match(/Created (\d+)/)
      const updatedMatch = line.match(/Updated (\d+)/)
      
      if (totalMatch) stats.total = parseInt(totalMatch[1])
      if (processedMatch) stats.processed = parseInt(processedMatch[1])
      if (createdMatch) stats.created = parseInt(createdMatch[1])
      if (updatedMatch) stats.updated = parseInt(updatedMatch[1])
    })
    
    if (stats.created > 0 || stats.updated > 0) {
      const parts = []
      if (stats.created > 0) parts.push(`${stats.created} new job${stats.created > 1 ? 's' : ''}`)
      if (stats.updated > 0) parts.push(`${stats.updated} updated`)
      return parts.join(', ')
    } else if (stats.processed > 0) {
      return `${stats.processed} email${stats.processed > 1 ? 's' : ''} processed`
    } else {
      return 'No updates found'
    }
  }

  return (
    <div 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        isVisible && !isExiting
          ? 'opacity-100 translate-y-0'
          : isExiting
          ? 'opacity-0 -translate-y-4 scale-95'
          : 'opacity-0 -translate-y-4 scale-95'
      }`}
    >
      <div className="w-full max-w-sm rounded-lg bg-card border border-border shadow-lg p-3 flex items-center gap-3">
        <div
          className={`flex-shrink-0 size-5 rounded-full flex items-center justify-center ${
            isSuccess
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {isSuccess ? (
            <CheckCircle className="size-5" />
          ) : (
            <XCircle className="size-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isSuccess ? 'Sync complete' : 'Sync failed'}
            {isSuccess && `: ${getSimpleMessage()}`}
          </p>
        </div>
      </div>
    </div>
  )
}
