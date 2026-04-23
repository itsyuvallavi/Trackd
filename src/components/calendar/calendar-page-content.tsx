'use client'

import { JobStatus } from '@prisma/client'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STATUS_COLORS } from '@/lib/constants'
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, isPast, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { EventPopover } from './event-popover'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Calendar, CheckCircle2, Mail } from 'lucide-react'
import { AddInterviewModal } from './add-interview-modal'

type CalendarEventType = 'INTERVIEW' | 'FOLLOW_UP' | 'OFFER'

export interface CalendarEvent {
  id: string
  jobId: string
  date: Date
  type: CalendarEventType
  title: string
  subtitle: string
  status: JobStatus
}

interface CalendarPageContentProps {
  events: CalendarEvent[]
  monthStart: Date
}

// Helper functions for event type styling — redesigned with tokenized colors.
function getEventTypeColor(eventType: CalendarEventType): string {
  switch (eventType) {
    case 'INTERVIEW':
      return 'bg-info-bg text-info-text border-info/20'
    case 'OFFER':
      return 'bg-success-bg text-success-text border-success/20'
    case 'FOLLOW_UP':
      return 'bg-warning-bg text-warning-text border-warning/20'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function getEventDotClass(eventType: CalendarEventType): string {
  switch (eventType) {
    case 'INTERVIEW':
      return 'bg-info'
    case 'OFFER':
      return 'bg-success'
    case 'FOLLOW_UP':
      return 'bg-warning'
    default:
      return 'bg-muted-foreground'
  }
}

function getEventTypeLabel(eventType: CalendarEventType): string {
  switch (eventType) {
    case 'INTERVIEW':
      return 'Interview'
    case 'OFFER':
      return 'Offer'
    case 'FOLLOW_UP':
      return 'Follow-up'
    default:
      return 'Event'
  }
}

function getEventTypeIcon(eventType: CalendarEventType) {
  switch (eventType) {
    case 'INTERVIEW':
      return Calendar
    case 'OFFER':
      return CheckCircle2
    case 'FOLLOW_UP':
      return Mail
    default:
      return Calendar
  }
}

export function CalendarPageContent({ events, monthStart }: CalendarPageContentProps) {
  const router = useRouter()
  const today = new Date()

  const monthEnd = endOfMonth(monthStart)

  // Filter events for current month
  const viewEvents = events.filter((event) => {
    return event.date >= monthStart && event.date <= monthEnd
  })

  // Days for month view
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfMonth(monthStart),
  })

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const handleEventClick = (event: CalendarEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setPopoverAnchor({ x: rect.left, y: rect.bottom })
    setSelectedEvent(event)
  }

  const handleClosePopover = () => {
    setSelectedEvent(null)
    setPopoverAnchor(null)
  }

  const handleDayClick = (day: Date) => {
    // Only allow adding interviews to current month days
    if (isSameMonth(day, monthStart)) {
      setSelectedDay(day)
      setIsAddModalOpen(true)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next' | 'today') => {
    let newMonthStart: Date
    if (direction === 'prev') {
      newMonthStart = subMonths(monthStart, 1)
    } else if (direction === 'next') {
      newMonthStart = addMonths(monthStart, 1)
    } else {
      newMonthStart = startOfMonth(today)
    }

    const month = newMonthStart.getMonth() + 1 // JavaScript months are 0-indexed, URL uses 1-indexed
    const year = newMonthStart.getFullYear()
    router.push(`/calendar?month=${month}&year=${year}`)
  }

  const handleInterviewAdded = () => {
    setIsAddModalOpen(false)
    setSelectedDay(null)
    router.refresh()
  }

  // Glass event pill — compact, color-dotted, minimal.
  const renderEventCard = (event: CalendarEvent, isPastEvent: boolean) => {
    const eventTypeColor = getEventTypeColor(event.type)
    const dotClass = getEventDotClass(event.type)

    return (
      <button
        key={event.id}
        onClick={(e) => {
          e.stopPropagation()
          handleEventClick(event, e.currentTarget)
        }}
        className={cn(
          'group w-full text-left rounded-lg px-2 py-1.5',
          'glass glass-subtle border',
          'transition-[transform,box-shadow,opacity] duration-150 ease-[var(--ease-ios)]',
          'hover:-translate-y-0.5',
          isPastEvent && 'opacity-55 hover:opacity-80',
          eventTypeColor
        )}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn('size-1.5 rounded-full shrink-0', dotClass)}
          />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-[11px] font-medium line-clamp-1',
                isPastEvent ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {event.title}
            </p>
            <p className="text-[10px] text-muted-foreground line-clamp-1">
              {event.subtitle}
              {event.type === 'INTERVIEW' && event.date && (
                <>
                  <span className="mx-1">·</span>
                  <span className="tabular-nums">
                    {format(event.date, 'h:mm a')}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </button>
    )
  }

  // Month View — hairline grid with cobalt today dot and glass day cells.
  const renderMonthView = (daysToRender: Date[], eventsToShow: CalendarEvent[], monthRef: Date, todayDate: Date) => {
    return (
      <div className="glass glass-subtle rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/40">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
            <div
              key={label}
              className="px-3 py-3 text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium"
            >
              {label}
            </div>
          ))}
        </div>
        <div
          key={monthRef.toISOString()}
          className="grid grid-cols-7 trackd-route-enter"
        >
          {daysToRender.map((day) => {
            const isCurrentMonth = day.getMonth() === monthRef.getMonth()
            const isToday = isSameDay(day, todayDate)
            const dayEvents = eventsToShow.filter((event) => isSameDay(event.date, day))
            const isEmpty = isCurrentMonth && dayEvents.length === 0

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[140px] md:min-h-[120px] p-2.5 md:p-3 align-top relative group',
                  'border-b border-r border-border/40 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                  !isCurrentMonth && 'opacity-40',
                  isCurrentMonth && 'cursor-pointer hover:bg-foreground/[0.03] transition-colors duration-150'
                )}
                onClick={() => isCurrentMonth && handleDayClick(day)}
                title={isEmpty ? 'Click to add interview' : undefined}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  {isToday && (
                    <span
                      aria-hidden
                      className="inline-block size-1.5 rounded-full bg-primary trackd-breath"
                    />
                  )}
                  <span
                    className={cn(
                      'text-xs md:text-sm tabular-nums',
                      isToday && 'text-primary font-semibold',
                      !isCurrentMonth && 'opacity-60'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div
                  className="space-y-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {dayEvents.length === 0 && isCurrentMonth && (
                    <div className="py-2 text-center">
                      <p className="text-[9px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        + Click to add
                      </p>
                    </div>
                  )}
                  {dayEvents.map((event) => {
                    const isPastEvent = isPast(event.date) && !isSameDay(event.date, todayDate)
                    return renderEventCard(event, isPastEvent)
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }


  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Interviews, offers, and important dates.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="h-8 px-2"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-sm font-medium text-foreground min-w-[140px] text-center">
            {format(monthStart, 'MMMM yyyy')}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="h-8 px-2"
          >
            <ChevronRight className="size-4" />
          </Button>
          {!isSameMonth(monthStart, today) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('today')}
              className="h-8 px-3 text-xs"
            >
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="icon"
            onClick={() => {
              setSelectedDay(today)
              setIsAddModalOpen(true)
            }}
            className="h-8 w-8"
            aria-label="Add interview"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {renderMonthView(days, viewEvents, monthStart, today)}

      {/* Event Popover */}
      {selectedEvent && popoverAnchor && (
        <EventPopover
          event={selectedEvent}
          anchor={popoverAnchor}
          onClose={handleClosePopover}
        />
      )}

      {/* Add Interview Modal */}
      {isAddModalOpen && (
        <AddInterviewModal
          isOpen={isAddModalOpen}
          initialDate={selectedDay || today}
          onClose={() => {
            setIsAddModalOpen(false)
            setSelectedDay(null)
          }}
          onInterviewAdded={handleInterviewAdded}
        />
      )}
    </>
  )
}

