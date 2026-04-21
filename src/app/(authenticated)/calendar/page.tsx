import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { prisma } from '@/lib/prisma'
import { JobStatus } from '@prisma/client'
import { startOfMonth, endOfMonth } from 'date-fns'
import { CalendarPageWrapper } from '@/components/calendar/calendar-page-wrapper'
import { CalendarEvent } from '@/components/calendar/calendar-page-content'
import { serializeForClient } from '@/lib/serialize-for-client'

function buildEvents(jobs: any[]): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const job of jobs) {
    // Show interviews (any job with interviewAt)
    if (job.interviewAt) {
      events.push({
        id: `${job.id}-interview`,
        jobId: job.id,
        date: job.interviewAt,
        type: 'INTERVIEW',
        title: job.title,
        subtitle: job.company,
        status: job.status as JobStatus,
      })
    }
    
    // Show offers (OFFER status jobs - use updatedAt as the date if no interviewAt)
    if (job.status === 'OFFER') {
      // For offers, use interviewAt if available, otherwise use updatedAt when status changed to OFFER
      const offerDate = job.interviewAt || job.updatedAt
      events.push({
        id: `${job.id}-offer`,
        jobId: job.id,
        date: offerDate,
        type: 'OFFER',
        title: job.title,
        subtitle: job.company,
        status: job.status as JobStatus,
      })
    }
  }

  return events
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const user = await requireAuth()
  const today = new Date()
  const params = await searchParams

  // Parse month/year from URL params, default to current month
  let monthStart: Date
  if (params.month && params.year) {
    const month = parseInt(params.month, 10) - 1 // JavaScript months are 0-indexed
    const year = parseInt(params.year, 10)
    if (!isNaN(month) && !isNaN(year) && month >= 0 && month <= 11) {
      monthStart = startOfMonth(new Date(year, month, 1))
    } else {
      monthStart = startOfMonth(today)
    }
  } else {
    monthStart = startOfMonth(today)
  }

  const monthEnd = endOfMonth(monthStart)

  // Fetch all jobs with interview dates OR OFFER status
  // Include all events, not just current month, for navigation purposes
  const jobs = await prisma.job.findMany({
    where: {
      userId: user.id,
      status: { notIn: ['ARCHIVED', 'REJECTED'] },
      OR: [
        { interviewAt: { not: null } },
        { status: 'OFFER' }, // Include all OFFER jobs even without interviewAt
      ],
    },
    select: {
      id: true,
      title: true,
      company: true,
      status: true,
      interviewAt: true,
      location: true,
      updatedAt: true,
    },
    orderBy: { savedAt: 'desc' },
  })

  const allEvents = buildEvents(jobs)

  return (
    <AppShell>
      <CalendarPageWrapper 
        events={serializeForClient(allEvents)} 
        monthStart={monthStart}
      />
    </AppShell>
  )
}


