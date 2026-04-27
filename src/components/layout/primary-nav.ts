import type { LucideIcon } from 'lucide-react'
import { Briefcase, Bot, Mail, FileText } from 'lucide-react'

export interface PrimaryNavItem {
  /** Label in the desktop sidebar */
  name: string
  /** Compact label for the mobile tab bar (active tab) */
  shortLabel: string
  href: string
  icon: LucideIcon
  disabled?: boolean
}

/**
 * Single source of truth for primary app navigation (desktop sidebar + mobile tabs).
 */
export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { name: 'Applications', shortLabel: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Job Search', shortLabel: 'Search', href: '/bot', icon: Bot },
  { name: 'Email sync', shortLabel: 'Email', href: '/settings/integrations', icon: Mail },
  {
    name: 'Resume Advisor',
    shortLabel: 'Resume',
    href: '/resume-advisor',
    icon: FileText,
  },
]
