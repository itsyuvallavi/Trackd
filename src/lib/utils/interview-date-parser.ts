/**
 * Parse interview date and time from extracted entities
 * Returns a Date object or null if parsing fails
 */
export function parseInterviewDateTime(
  interviewDate: string | null | undefined,
  interviewTime: string | null | undefined
): Date | null {
  if (!interviewDate) {
    return null
  }

  try {
    // Parse date (expected format: YYYY-MM-DD)
    const dateParts = interviewDate.split('-')
    if (dateParts.length !== 3) {
      console.warn(`Invalid date format: ${interviewDate}`)
      return null
    }

    const year = parseInt(dateParts[0], 10)
    const month = parseInt(dateParts[1], 10) - 1 // JavaScript months are 0-indexed
    const day = parseInt(dateParts[2], 10)

    // Validate date parts
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.warn(`Invalid date parts: ${interviewDate}`)
      return null
    }

    // Validate month (0-11 after subtracting 1)
    if (month < 0 || month > 11) {
      console.warn(`Invalid month: ${interviewDate}`)
      return null
    }

    // Validate day (basic check - will be validated by Date constructor)
    if (day < 1 || day > 31) {
      console.warn(`Invalid day: ${interviewDate}`)
      return null
    }

    // Parse time if provided (expected format: HH:MM)
    let hours = 0
    let minutes = 0

    if (interviewTime && interviewTime !== 'null' && interviewTime.trim() !== '') {
      const timeParts = interviewTime.split(':')
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10)
        minutes = parseInt(timeParts[1], 10)
        
        // Validate time parts - if parsing fails, the time format is invalid
        if (isNaN(hours) || isNaN(minutes)) {
          console.warn(`Invalid time format: ${interviewTime}`)
          return null
        }
        
        // Validate hour range (0-23)
        if (hours < 0 || hours > 23) {
          console.warn(`Invalid hour: ${interviewTime}`)
          return null
        }
        // Validate minute range (0-59)
        if (minutes < 0 || minutes > 59) {
          console.warn(`Invalid minute: ${interviewTime}`)
          return null
        }
      } else {
        // Time format doesn't match HH:MM pattern
        console.warn(`Invalid time format (expected HH:MM): ${interviewTime}`)
        return null
      }
    }

    const date = new Date(year, month, day, hours, minutes, 0, 0)
    
    // Validate the date - check if it's actually the date we intended
    // (Date constructor can roll over invalid dates, e.g., Feb 30 becomes Mar 2)
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date/time: ${interviewDate} ${interviewTime}`)
      return null
    }

    // Check if the date was rolled over (indicates invalid date)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      console.warn(`Date was rolled over (invalid date): ${interviewDate}`)
      return null
    }

    return date
  } catch (error) {
    console.error('Error parsing interview date/time:', error)
    return null
  }
}

