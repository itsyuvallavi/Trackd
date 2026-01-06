import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { AppShell } from '@/components/layout/app-shell'
import { StatusStats } from '@/components/dashboard/status-stats'
import { JobStatus } from '@prisma/client'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const revalidate = 30 // Revalidate every 30 seconds (more frequent for today view)

// Helper function to get status background color
function getStatusBackgroundColor(status: JobStatus): string {
  const statusBgMap: Record<JobStatus, string> = {
    'SAVED': 'bg-muted/50',
    'APPLIED': 'bg-info-bg/50',
    'INTERVIEW': 'bg-purple-100/50 dark:bg-purple-900/20',
    'OFFER': 'bg-success-bg/50',
    'REJECTED': 'bg-error-bg/50',
    'ARCHIVED': 'bg-warning-bg/50',
  }
  return statusBgMap[status] || 'bg-muted/50'
}

export default async function TodayPage() {
  const user = await requireAuth()
  const today = new Date()
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(today.getDate() + 7)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Optimize: Combine queries using Promise.all and fetch only needed data
  const [statusCounts, activeJobs, recentActivities, recentAppliedActivities] = await Promise.all([
    // Use groupBy for efficient status counting
    prisma.job.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    }),
    // Only fetch active jobs (SAVED, APPLIED, INTERVIEW) with minimal fields
    prisma.job.findMany({
      where: {
        userId: user.id,
        status: { in: ['SAVED', 'APPLIED', 'INTERVIEW'] },
      },
      select: {
        id: true,
        title: true,
        company: true,
        status: true,
        savedAt: true,
        interviewAt: true,
        nextAction: true,
      },
      orderBy: { savedAt: 'desc' },
    }),
    // Get recent activities with selected job fields
    prisma.activity.findMany({
      where: {
        userId: user.id,
        type: { in: ['STATUS_CHANGE', 'INTERVIEW', 'REJECTION', 'OFFER'] },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        type: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        jobId: true,
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Get recent APPLIED status changes
    prisma.activity.findMany({
      where: {
        userId: user.id,
        toStatus: 'APPLIED',
        type: 'STATUS_CHANGE',
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        jobId: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Get job IDs that were recently applied (moved TO APPLIED in last 7 days)
  const recentlyAppliedJobIds = new Set(recentAppliedActivities.map(a => a.jobId))

  // Convert groupBy result to status counts
  const statusCountsMap: Record<JobStatus, number> = {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  }

  statusCounts.forEach((item) => {
    statusCountsMap[item.status as JobStatus] = item._count
  })

  // Active jobs already fetched with filter
  const jobs = activeJobs

  // Categorize jobs by urgency
  const categorizedJobs = {
    overdue: jobs.filter(job => {
      if (!job.nextAction) return false
      // Jobs saved more than 7 days ago without follow-up
      const daysSinceSaved = Math.floor((today.getTime() - job.savedAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceSaved > 7 && job.status === 'SAVED'
    }),
    dueToday: jobs.filter(job => {
      // Only show jobs that are currently in INTERVIEW status AND have interview date today
      if (job.status !== 'INTERVIEW' || !job.interviewAt) return false
      const interviewDate = new Date(job.interviewAt)
      return interviewDate.toDateString() === today.toDateString()
    }),
    dueSoon: jobs.filter(job => {
      const daysSinceSaved = Math.floor((today.getTime() - job.savedAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceSaved >= 3 && daysSinceSaved <= 7 && job.status === 'SAVED'
    }),
    recentlyApplied: jobs.filter(job => {
      // Only show jobs that were actually moved TO APPLIED status in the last 7 days
      // (not jobs that were already applied and then moved back to applied)
      return recentlyAppliedJobIds.has(job.id) && job.status === 'APPLIED'
    }),
    withNextAction: jobs.filter(job => job.nextAction), // Already filtered to active statuses
    recentStatusChanges: recentActivities.slice(0, 5), // Already filtered by date in query
  }

  const totalNeedingAttention =
    categorizedJobs.overdue.length +
    categorizedJobs.dueToday.length +
    categorizedJobs.dueSoon.length

  const emailIntegration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-2">Today</h1>
            <p className="text-sm text-muted-foreground">
              {totalNeedingAttention === 0
                ? "You're all caught up!"
                : `${totalNeedingAttention} ${
                    totalNeedingAttention === 1 ? 'job needs' : 'jobs need'
                  } attention`}
            </p>
          </div>

          {/* Status Counter Widget */}
          <div className="mb-6 md:mb-8">
            <StatusStats counts={statusCountsMap} />
          </div>

            <div className="space-y-8">
              {/* Recent Status Changes */}
          {categorizedJobs.recentStatusChanges.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Recent Status Changes</h2>
              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {categorizedJobs.recentStatusChanges.map((activity) => (
                        <tr key={activity.id} className={`border-b last:border-0 ${getStatusBackgroundColor(activity.job.status)} hover:opacity-80 transition-opacity`}>
                          <td className="p-4">
                            <Link href={`/jobs/${activity.jobId}`} className="font-medium hover:underline">
                              {activity.job.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">{activity.job.company}</p>
                          </td>
                          <td className="p-4">
                            {activity.fromStatus && activity.toStatus && (
                              <div className="flex items-center gap-2">
                                <Badge className={STATUS_COLORS[activity.fromStatus]}>{STATUS_LABELS[activity.fromStatus]}</Badge>
                                <span className="text-muted-foreground">→</span>
                                <Badge className={STATUS_COLORS[activity.toStatus]}>{STATUS_LABELS[activity.toStatus]}</Badge>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {formatRelativeTime(activity.createdAt)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Next Actions Due */}
          {categorizedJobs.withNextAction.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Next Actions Due</h2>
              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {categorizedJobs.withNextAction.map((job) => (
                        <tr key={job.id} className={`border-b last:border-0 ${getStatusBackgroundColor(job.status)} hover:opacity-80 transition-opacity`}>
                          <td className="p-4">
                            <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                              {job.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">{job.company}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-orange-600 dark:text-orange-400">⚡ {job.nextAction}</p>
                          </td>
                          <td className="p-4">
                            <Badge className={STATUS_COLORS[job.status]}>{STATUS_LABELS[job.status]}</Badge>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Interviews Today */}
          {categorizedJobs.dueToday.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-purple-600 dark:text-purple-400">
                🎯 Interviews Today ({categorizedJobs.dueToday.length})
              </h2>
              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {categorizedJobs.dueToday.map((job) => (
                        <tr key={job.id} className={`border-b last:border-0 ${getStatusBackgroundColor(job.status)} hover:opacity-80 transition-opacity`}>
                          <td className="p-4">
                            <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">{job.company}</Link>
                          </td>
                          <td className="p-4">{job.title}</td>
                          <td className="p-4">{job.status}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overdue */}
          {categorizedJobs.overdue.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
                ⚠️ Needs Follow-up ({categorizedJobs.overdue.length})
              </h2>
              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {categorizedJobs.overdue.map((job) => (
                        <tr key={job.id} className={`border-b last:border-0 ${getStatusBackgroundColor(job.status)} hover:opacity-80 transition-opacity`}>
                          <td className="p-4">
                            <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">{job.company}</Link>
                          </td>
                          <td className="p-4">{job.title}</td>
                          <td className="p-4">{job.status}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Due Soon */}
          {categorizedJobs.dueSoon.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-orange-600 dark:text-orange-400">
                ⏰ Follow up soon ({categorizedJobs.dueSoon.length})
              </h2>
              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {categorizedJobs.dueSoon.map((job) => (
                        <tr key={job.id} className={`border-b last:border-0 ${getStatusBackgroundColor(job.status)} hover:opacity-80 transition-opacity`}>
                          <td className="p-4">
                            <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">{job.company}</Link>
                          </td>
                          <td className="p-4">{job.title}</td>
                          <td className="p-4">{job.status}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recently Applied */}
          {categorizedJobs.recentlyApplied.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
                📤 Recently Applied ({categorizedJobs.recentlyApplied.length})
              </h2>
              <div className="border border-foreground/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {categorizedJobs.recentlyApplied.map((job) => (
                        <tr key={job.id} className={`border-b last:border-0 ${getStatusBackgroundColor(job.status)} hover:opacity-80 transition-opacity`}>
                          <td className="p-4">
                            <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">{job.company}</Link>
                          </td>
                          <td className="p-4">{job.title}</td>
                          <td className="p-4">{job.status}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {totalNeedingAttention === 0 && categorizedJobs.recentlyApplied.length === 0 && (
            <div className="text-center py-16 border border-foreground/20 rounded-lg">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-lg font-medium mb-2">All Caught Up!</h3>
              <p className="text-foreground/60 mb-6">
                No jobs need immediate attention. Keep up the great work!
              </p>
              <Link href="/jobs">
                <Button>Add Another Job</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
      </div>
    </AppShell>
  )
}