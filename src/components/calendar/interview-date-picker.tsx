'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InterviewDatePickerProps {
  initialDate: Date | null
  onSave: (date: Date | null) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  showSaveButton?: boolean
  onChange?: (date: Date | null) => void
}

export function InterviewDatePicker({
  initialDate,
  onSave,
  onCancel,
  isSubmitting = false,
  showSaveButton = true,
  onChange,
}: InterviewDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  )
  const [selectedTime, setSelectedTime] = useState<string>(
    initialDate ? format(initialDate, 'HH:mm') : '09:00'
  )

  // Update when initialDate changes
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(format(initialDate, 'yyyy-MM-dd'))
      setSelectedTime(format(initialDate, 'HH:mm'))
    }
  }, [initialDate])

  // Call onChange when date/time changes (only for manual changes, not initial load)
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    if (onChange && newDate && selectedTime) {
      try {
        const [hours, minutes] = selectedTime.split(':').map(Number)
        const dateTime = new Date(newDate)
        dateTime.setHours(hours, minutes, 0, 0)
        if (!isNaN(dateTime.getTime())) {
          onChange(dateTime)
        }
      } catch (error) {
        // Invalid date, ignore
      }
    }
  }

  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime)
    if (onChange && selectedDate && newTime) {
      try {
        const [hours, minutes] = newTime.split(':').map(Number)
        const dateTime = new Date(selectedDate)
        dateTime.setHours(hours, minutes, 0, 0)
        if (!isNaN(dateTime.getTime())) {
          onChange(dateTime)
        }
      } catch (error) {
        // Invalid date, ignore
      }
    }
  }

  const handleSave = async () => {
    if (!selectedDate || !selectedTime) {
      alert('Please select both date and time')
      return
    }

    const [hours, minutes] = selectedTime.split(':').map(Number)
    const dateTime = new Date(selectedDate)
    dateTime.setHours(hours, minutes, 0, 0)

    await onSave(dateTime)
  }

  const handleClear = async () => {
    await onSave(null)
  }

  return (
    <div className="space-y-4">
      {/* Date Input */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Date
        </label>
        <div className="relative">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={isSubmitting}
          />
          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Time Input */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Time
        </label>
        <div className="relative">
          <input
            type="time"
            value={selectedTime}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={isSubmitting}
          />
          <Clock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Preview */}
      {selectedDate && selectedTime && (
        <div className="p-2 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground mb-0.5">Scheduled for:</p>
          <p className="text-xs font-medium">
            {format(
              new Date(`${selectedDate}T${selectedTime}`),
              'EEEE, MMMM d, yyyy \'at\' h:mm a'
            )}
          </p>
        </div>
      )}

      {/* Actions */}
      {showSaveButton && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !selectedDate || !selectedTime}
            size="sm"
            className="flex-1"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
          <Button
            onClick={handleClear}
            disabled={isSubmitting}
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="size-4" />
          </Button>
          <Button
            onClick={onCancel}
            disabled={isSubmitting}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

