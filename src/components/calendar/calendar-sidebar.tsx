'use client'

import { CalendarEvent } from './calendar-page-content'
import { Badge } from '@/components/ui/badge'
import { format, isToday, isTomorrow, differenceInDays, isPast } from 'date-fns'
import { Calendar, Clock, ChevronRight, CheckCircle2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'

function getEventTypeColor(eventType: CalendarEvent['type']): string {
  switch (eventType) {
    case 'INTERVIEW':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    case 'OFFER':
      return 'bg-green-500/10 text-green-600 dark:text-green-400'
    case 'FOLLOW_UP':
      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function getEventTypeLabel(eventType: CalendarEvent['type']): string {
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

function getEventTypeIcon(eventType: CalendarEvent['type']) {
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

interface CalendarSidebarProps {
  events: CalendarEvent[]
  onClose?: () => void
  onExpand?: () => void
  isCollapsed?: boolean
}

export function CalendarSidebar({ 
  events, 
  onClose,
  onExpand,
  isCollapsed: externalIsCollapsed 
}: CalendarSidebarProps) {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  
  const isCollapsed = externalIsCollapsed ?? internalIsCollapsed

  const handleCollapse = () => {
    if (externalIsCollapsed !== undefined) {
      onClose?.()
    } else {
      setInternalIsCollapsed(true)
      onClose?.()
    }
  }

  const handleExpand = () => {
    if (externalIsCollapsed !== undefined) {
      onExpand?.()
    } else {
      setInternalIsCollapsed(false)
      onExpand?.()
    }
  }

  // Get upcoming events (next 14 days, sorted by date)
  const now = new Date()
  const upcomingEvents = events
    .filter((event) => {
      const eventDate = event.date
      const daysUntil = differenceInDays(eventDate, now)
      return daysUntil >= -1 && daysUntil <= 14 // Include today and next 14 days
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10) // Limit to 10 events

  const getEventLabel = (eventDate: Date) => {
    if (isPast(eventDate) && !isToday(eventDate)) {
      return 'Past'
    }
    if (isToday(eventDate)) {
      return 'Today'
    }
    if (isTomorrow(eventDate)) {
      return 'Tomorrow'
    }
    const daysUntil = differenceInDays(eventDate, now)
    return `In ${daysUntil} days`
  }

  const getEventBadgeColor = (eventDate: Date) => {
    if (isPast(eventDate) && !isToday(eventDate)) {
      return 'bg-muted text-muted-foreground'
    }
    if (isToday(eventDate)) {
      return 'bg-primary/10 text-primary'
    }
    if (isTomorrow(eventDate)) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    }
    return 'bg-muted/60 text-muted-foreground'
  }

  if (isCollapsed) {
    return (
      <div className={cn(
        'w-8 border-l border-border bg-card flex flex-col fixed right-0 top-[64px] bottom-0 h-[calc(100vh-64px)] z-30',
        'transition-all duration-500 ease-out',
        'animate-in slide-in-from-right-full'
      )}>
        <div className="bg-card border-b border-border px-2 pt-6 pb-2.5 flex items-center justify-center shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rotate-180 transition-transform duration-500 ease-out"
            onClick={handleExpand}
            aria-label="Expand sidebar"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'w-[266px] border-l border-border bg-card flex flex-col fixed right-0 top-[64px] bottom-0 h-[calc(100vh-64px)] z-30',
      'transition-all duration-500 ease-out',
      'animate-in slide-in-from-right-full'
    )}>
      {/* Header with Toggle */}
      <div className="bg-card border-b border-border px-3 pt-6 pb-2.5 flex items-center justify-between z-10 shrink-0">
        <span className="text-xs font-medium text-foreground">Upcoming</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 transition-transform duration-500 ease-out"
          onClick={handleCollapse}
          aria-label="Minimize sidebar"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* Content Area - Independently scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 animate-in fade-in duration-500 delay-100 ease-out">
        <div className="p-3 space-y-2">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground animate-in fade-in duration-500 delay-150 ease-out">
              <p className="text-sm">No upcoming events</p>
              <p className="text-xs mt-1">Interviews and offers will appear here</p>
            </div>
          ) : (
              upcomingEvents.map((event, index) => {
                const iconDelay = 250 + (index * 60)
                const contentDelay = 400 + (index * 60)
                const eventLabel = getEventLabel(event.date)
                const badgeColor = getEventBadgeColor(event.date)
                const EventIcon = getEventTypeIcon(event.type)
                const eventTypeColor = getEventTypeColor(event.type)
                const isPastEvent = isPast(event.date) && !isToday(event.date)

                return (
                  <Link
                    key={event.id}
                    href={`/jobs/${event.jobId}`}
                    className={cn(
                      'block p-2.5 rounded-lg border hover:bg-accent/50 transition-colors group',
                      'animate-in fade-in duration-500 ease-out',
                      isToday(event.date) && 'border-primary/50 bg-primary-lightest/30',
                      isPastEvent && 'opacity-75 border-border/40',
                      eventTypeColor
                    )}
                    style={{
                      animationDelay: `${contentDelay}ms`
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 shrink-0 animate-in fade-in zoom-in-50 duration-500 ease-out"
                        style={{
                          animationDelay: `${iconDelay}ms`
                        }}
                      >
                        <EventIcon className={cn(
                          'size-3.5',
                          event.type === 'INTERVIEW' && 'text-blue-600 dark:text-blue-400',
                          event.type === 'OFFER' && 'text-green-600 dark:text-green-400',
                          event.type === 'FOLLOW_UP' && 'text-yellow-600 dark:text-yellow-400',
                          !['INTERVIEW', 'OFFER', 'FOLLOW_UP'].includes(event.type) && 'text-primary'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5 mb-0.5">
                          <p className={cn(
                            'text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors',
                            isPastEvent && 'text-muted-foreground'
                          )}>
                            {event.title}
                          </p>
                          <Badge className={cn('text-[9px] px-1.5 py-0.5 shrink-0', badgeColor)}>
                            {eventLabel}
                          </Badge>
                        </div>
                        <p className={cn(
                          'text-[10px] mb-1 line-clamp-1',
                          isPastEvent ? 'text-muted-foreground/70' : 'text-muted-foreground'
                        )}>
                          {event.subtitle}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'flex items-center gap-1.5 text-[10px]',
                            isPastEvent ? 'text-muted-foreground/70' : 'text-muted-foreground'
                          )}>
                            <Clock className="size-3" />
                            <span>{format(event.date, 'MMM d')}</span>
                            {event.type === 'INTERVIEW' && (
                              <span>{format(event.date, 'h:mm a')}</span>
                            )}
                          </div>
                          <Badge className={cn(
                            'text-[9px] px-1.5 py-0.5 shrink-0 border',
                            eventTypeColor,
                            isPastEvent && 'opacity-60'
                          )}>
                            {getEventTypeLabel(event.type)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })
          )}
        </div>
      </div>
    </div>
  )
}

