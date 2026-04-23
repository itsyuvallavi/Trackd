'use client'

import { CalendarEvent } from './calendar-page-content'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS } from '@/lib/constants'
import { format } from 'date-fns'
import { Calendar, Clock, Building2, Edit2, Trash2, ExternalLink, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { InterviewDatePicker } from './interview-date-picker'
import { updateInterviewDate, removeInterview } from '@/app/(authenticated)/calendar/actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface EventPopoverProps {
  event: CalendarEvent
  anchor: { x: number; y: number }
  onClose: () => void
}

export function EventPopover({ event, anchor, onClose }: EventPopoverProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y, placement: 'bottom' as 'top' | 'bottom' })
  const router = useRouter()

  useEffect(() => {
    // Adjust position to stay within viewport with collision detection
    if (typeof window !== 'undefined') {
      const popoverWidth = isEditing ? 320 : 280
      const estimatedHeight = isEditing ? 400 : 300 // Approximate height (generous estimate)
      const spacing = 8 // Gap between anchor and popover
      const viewportPadding = 16 // Padding from viewport edges
      
      // Check horizontal boundaries
      let left = anchor.x
      if (left + popoverWidth > window.innerWidth - viewportPadding) {
        left = window.innerWidth - popoverWidth - viewportPadding
      }
      if (left < viewportPadding) {
        left = viewportPadding
      }
      
      // Check vertical boundaries and determine placement
      const spaceBelow = window.innerHeight - anchor.y - spacing - viewportPadding
      const spaceAbove = anchor.y - spacing - viewportPadding
      
      // Place above if not enough space below, but enough space above (with buffer)
      // Use a buffer (e.g., 50px) to ensure comfortable spacing
      const buffer = 50
      const shouldPlaceAbove = spaceBelow < estimatedHeight + buffer && spaceAbove > estimatedHeight + buffer
      
      let top: number
      let placement: 'top' | 'bottom'
      
      if (shouldPlaceAbove) {
        // Position above the anchor - use available space above
        const availableSpaceAbove = spaceAbove
        top = anchor.y - Math.min(estimatedHeight, availableSpaceAbove) - spacing
        if (top < viewportPadding) {
          top = viewportPadding
        }
        placement = 'top'
      } else {
        // Position below the anchor (default)
        top = anchor.y + spacing
        // Ensure it doesn't go below viewport - use available space below
        const availableSpaceBelow = window.innerHeight - top - viewportPadding
        // If there's not enough space, adjust upward
        if (availableSpaceBelow < estimatedHeight) {
          top = window.innerHeight - Math.min(estimatedHeight, availableSpaceBelow) - viewportPadding
        }
        placement = 'bottom'
      }
      
      setPosition({ left, top, placement })
    }
  }, [anchor, isEditing])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSaveDate = async (dateTime: Date | null) => {
    setIsSubmitting(true)
    try {
      await updateInterviewDate(event.jobId, dateTime)
      router.refresh()
      onClose()
    } catch (error) {
      console.error('Failed to update interview date:', error)
      alert('Failed to update interview date. Please try again.')
    } finally {
      setIsSubmitting(false)
      setIsEditing(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this interview?')) {
      return
    }

    setIsSubmitting(true)
    try {
      await removeInterview(event.jobId)
      router.refresh()
      onClose()
    } catch (error) {
      console.error('Failed to remove interview:', error)
      alert('Failed to remove interview. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing) {
    return (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
        />
      <div
        className={cn(
          "!fixed z-50 glass glass-strong rounded-2xl p-4 w-[320px] animate-in fade-in duration-150 overflow-y-auto shadow-[var(--shadow-lg)]",
          position.placement === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
        )}
        style={{
          left: `${position.left}px`,
          top: `${position.top}px`,
          maxHeight: typeof window !== 'undefined' 
            ? position.placement === 'top'
              ? `${Math.max(200, position.top - 20)}px`
              : `${Math.max(200, window.innerHeight - position.top - 20)}px`
            : 'auto',
        }}
      >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Edit Interview Date & Time</h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <InterviewDatePicker
            initialDate={event.date}
            onSave={handleSaveDate}
            onCancel={() => {
              setIsEditing(false)
              onClose()
            }}
            isSubmitting={isSubmitting}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className={cn(
          "!fixed z-50 glass glass-strong rounded-2xl p-4 w-[280px] animate-in fade-in duration-150 overflow-y-auto shadow-[var(--shadow-lg)]",
          position.placement === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
        )}
        style={{
          left: `${position.left}px`,
          top: `${position.top}px`,
          maxHeight: typeof window !== 'undefined'
            ? position.placement === 'top'
              ? `${Math.max(200, position.top - 20)}px`
              : `${Math.max(200, window.innerHeight - position.top - 20)}px`
            : 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium line-clamp-2 mb-1">{event.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="size-3.5" />
              <span className="line-clamp-1">{event.subtitle}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Badge */}
        <div className="mb-3">
          <Badge
            className={cn(
              'border text-xs px-2 py-1 rounded-full',
              event.type === 'INTERVIEW' && 'bg-info-bg text-info-text border-info/20',
              event.type === 'OFFER' && 'bg-success-bg text-success-text border-success/20',
              event.type === 'FOLLOW_UP' && 'bg-warning-bg text-warning-text border-warning/20',
              !['INTERVIEW', 'OFFER', 'FOLLOW_UP'].includes(event.type) && STATUS_COLORS[event.status]
            )}
          >
            {event.type === 'INTERVIEW' ? 'Interview' : event.type === 'OFFER' ? 'Offer' : event.type === 'FOLLOW_UP' ? 'Follow-up' : 'Event'}
          </Badge>
        </div>

        {/* Date & Time */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            <span>{format(event.date, 'EEEE, MMMM d, yyyy')}</span>
          </div>
          {event.type === 'INTERVIEW' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span>{format(event.date, 'h:mm a')}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-3 border-t border-border">
          <Link
            href={`/jobs/${event.jobId}`}
            onClick={onClose}
            className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="size-3.5" />
            View Job
          </Link>
          {event.type === 'INTERVIEW' && (
            <>
              <button
                onClick={handleEdit}
                disabled={isSubmitting}
                className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                <Edit2 className="size-3.5" />
                Edit Date & Time
              </button>
              <button
                onClick={handleRemove}
                disabled={isSubmitting}
                className="flex items-center gap-2 text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Remove Interview
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

