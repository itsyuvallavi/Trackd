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

// Helper functions for event type styling
function getEventTypeColor(eventType: CalendarEventType): string {
  switch (eventType) {
    case 'INTERVIEW':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    case 'OFFER':
      return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
    case 'FOLLOW_UP':
      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
    default:
      return 'bg-muted text-muted-foreground border-border'
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

  // Render improved event card
  const renderEventCard = (event: CalendarEvent, isPastEvent: boolean) => {
    const EventIcon = getEventTypeIcon(event.type)
    const eventTypeColor = getEventTypeColor(event.type)
    
    return (
      <button
        key={event.id}
        onClick={(e) => {
          e.stopPropagation()
          handleEventClick(event, e.currentTarget)
        }}
        className={cn(
          'group w-full text-left rounded-lg px-3 py-2.5 transition-all border-2',
          isPastEvent
            ? 'bg-muted/30 hover:bg-muted/50 border-border/30 opacity-70'
            : 'bg-card hover:bg-accent border-border hover:border-primary/30 shadow-sm hover:shadow',
          eventTypeColor
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className={cn(
            'mt-0.5 shrink-0 rounded-md p-1.5',
            event.type === 'INTERVIEW' && 'bg-blue-500/10',
            event.type === 'OFFER' && 'bg-green-500/10',
            event.type === 'FOLLOW_UP' && 'bg-yellow-500/10'
          )}>
            <EventIcon className={cn(
              'size-3.5',
              event.type === 'INTERVIEW' && 'text-blue-600 dark:text-blue-400',
              event.type === 'OFFER' && 'text-green-600 dark:text-green-400',
              event.type === 'FOLLOW_UP' && 'text-yellow-600 dark:text-yellow-400',
              isPastEvent && 'opacity-60'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className={cn(
                'text-xs font-semibold line-clamp-1',
                isPastEvent ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {event.title}
              </p>
              <Badge
                className={cn(
                  'border-0 text-[10px] px-2 py-0.5 shrink-0 font-medium',
                  event.type === 'INTERVIEW' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  event.type === 'OFFER' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                  event.type === 'FOLLOW_UP' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                  isPastEvent && 'opacity-60'
                )}
              >
                {getEventTypeLabel(event.type)}
              </Badge>
            </div>
            <p className={cn(
              'text-xs line-clamp-1 mb-1.5',
              isPastEvent ? 'text-muted-foreground/70' : 'text-muted-foreground'
            )}>
              {event.subtitle}
            </p>
            {event.date && event.type === 'INTERVIEW' && (
              <p className={cn(
                'text-[10px] font-medium',
                event.type === 'INTERVIEW' && 'text-blue-600 dark:text-blue-400',
                isPastEvent && 'opacity-60'
              )}>
                {format(event.date, 'h:mm a')}
              </p>
            )}
          </div>
        </div>
      </button>
    )
  }

  // Month View
  const renderMonthView = (daysToRender: Date[], eventsToShow: CalendarEvent[], monthRef: Date, todayDate: Date) => {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-muted/60">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
            <div key={label} className="px-3 py-3 text-center text-xs text-muted-foreground">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {daysToRender.map((day) => {
            const isCurrentMonth = day.getMonth() === monthRef.getMonth()
            const isToday = isSameDay(day, todayDate)
            const dayEvents = eventsToShow.filter((event) => isSameDay(event.date, day))
            const isEmpty = isCurrentMonth && dayEvents.length === 0
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[140px] md:min-h-[120px] border-b border-r border-border/60 last:border-r-0 p-3 md:p-4 align-top relative group',
                  !isCurrentMonth && 'bg-muted/40 text-muted-foreground/60',
                  isToday && 'bg-primary-lightest/80',
                  isCurrentMonth && 'cursor-pointer hover:bg-muted/30 transition-colors',
                  isEmpty && 'hover:bg-primary-lightest/20'
                )}
                onClick={() => isCurrentMonth && handleDayClick(day)}
                title={isEmpty ? 'Click to add interview' : undefined}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('text-xs md:text-sm', !isCurrentMonth && 'opacity-60')}>
                    {format(day, 'd')}
                  </span>
                  {isToday && (
                    <span className="text-[10px] md:text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                      Today
                    </span>
                  )}
                </div>
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  {dayEvents.length === 0 && isCurrentMonth && (
                    <div className="text-center py-2">
                      <p className="text-[9px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to add
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
        <h1 className="text-2xl font-semibold mb-2">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Interviews, offers, and important dates. Jobs with scheduled interviews or offer status appear here.
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

