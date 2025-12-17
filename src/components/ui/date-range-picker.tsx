'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DateRange {
  from: Date | null
  to: Date | null
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempRange, setTempRange] = useState<DateRange>(value)
  const [selectingFrom, setSelectingFrom] = useState(true)

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }

  const getDisplayText = () => {
    if (!value.from && !value.to) {
      return 'Select date range'
    }
    if (value.from && value.to) {
      return `${formatDate(value.from)} – ${formatDate(value.to)}`
    }
    if (value.from) {
      return `${formatDate(value.from)} – Select end`
    }
    return 'Select date range'
  }

  const handleDateClick = (date: Date) => {
    if (selectingFrom) {
      setTempRange({ from: date, to: null })
      setSelectingFrom(false)
    } else {
      if (tempRange.from && date < tempRange.from) {
        setTempRange({ from: date, to: tempRange.from })
      } else {
        setTempRange({ ...tempRange, to: date })
      }
      setSelectingFrom(true)
    }
  }

  const handleApply = () => {
    onChange(tempRange)
    setIsOpen(false)
  }

  const handleClear = () => {
    const cleared = { from: null, to: null }
    setTempRange(cleared)
    onChange(cleared)
    setIsOpen(false)
  }

  const renderCalendar = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    const daysInMonth = lastDay.getDate()

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-9" />)
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day)
      const isSelected = (tempRange.from && date.toDateString() === tempRange.from.toDateString()) ||
                        (tempRange.to && date.toDateString() === tempRange.to.toDateString())
      const isInRange = tempRange.from && tempRange.to &&
                       date > tempRange.from && date < tempRange.to
      const isToday = date.toDateString() === today.toDateString()

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          className={cn(
            // Base sizing & layout
            'w-9 h-9 rounded-full text-xs sm:text-sm font-medium',
            'flex items-center justify-center transition-colors',
            // Hover
            'hover:bg-accent hover:text-accent-foreground',
            // Selected start / end dates
            isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold',
            // In-between range (only when not a selected endpoint)
            !isSelected && isInRange && 'bg-primary/15',
            // Today indicator when not selected
            isToday && !isSelected && 'border border-primary/70'
          )}
        >
          {day}
        </button>
      )
    }

    return days
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-4 gap-2 text-foreground hover:bg-accent justify-start"
      >
        <Calendar className="size-4" />
        <span className="text-sm">{getDisplayText()}</span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />

          {/* Calendar Dropdown */}
          <div className="absolute right-0 mt-2 p-4 bg-card border border-border rounded-lg shadow-2xl z-30 animate-in slide-in-from-top-2 fade-in duration-150 w-[320px]">
            {/* Month/Year Header */}
            <div className="mb-4 text-center">
              <h3 className="text-base font-bold text-foreground">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5">
                {selectingFrom ? 'Select start date' : 'Select end date'}
              </p>
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div
                  key={day}
                  className="w-9 h-7 flex items-center justify-center text-[11px] text-muted-foreground font-semibold"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {renderCalendar()}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground h-10 px-4"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!tempRange.from || !tempRange.to}
                className="h-10 px-6"
              >
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
