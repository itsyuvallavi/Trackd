import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a readable string
 * @param date - Date object or null
 * @returns Formatted date string or empty string if null
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  return format(new Date(date), 'MMM d, yyyy')
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "3 days ago")
 * @param date - Date object
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}
