import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { StatusStats } from '@/components/dashboard/status-stats'
import { JobStatus } from '@prisma/client'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const user = await requireAuth()
  const today = new Date()
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(today.getDate() + 7)

  // Get all jobs for status counts
  const allJobs = await prisma.job.findMany({
    where: {
      userId: user.id,
    },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 1, // Get most recent activity
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  // Get recent activities for status changes
  const recentActivities = await prisma.activity.findMany({
    where: {
      userId: user.id,
      type: {
        in: ['STATUS_CHANGE', 'INTERVIEW', 'REJECTION', 'OFFER'],
      },
    },
    include: {
      job: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Get recent status changes to APPLIED (to identify truly recently applied jobs)
  const recentAppliedActivities = await prisma.activity.findMany({
    where: {
      userId: user.id,
      toStatus: 'APPLIED',
      type: {
        in: ['STATUS_CHANGE'],
      },
      createdAt: {
        gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    include: {
      job: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Get job IDs that were recently applied (moved TO APPLIED in last 7 days)
  const recentlyAppliedJobIds = new Set(recentAppliedActivities.map(a => a.jobId))

  // Calculate status counts
  const statusCounts: Record<JobStatus, number> = {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    GHOSTED: 0,
  }

  allJobs.forEach((job) => {
    statusCounts[job.status] = (statusCounts[job.status] || 0) + 1
  })

  // Get jobs that need attention (active statuses only)
  const jobs = allJobs.filter((job) =>
    ['SAVED', 'APPLIED', 'INTERVIEW'].includes(job.status)
  )

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
    withNextAction: allJobs.filter(job => job.nextAction && ['SAVED', 'APPLIED', 'INTERVIEW'].includes(job.status)),
    recentStatusChanges: recentActivities.filter(activity => {
      // Show activities from last 7 days
      const daysSinceActivity = Math.floor((today.getTime() - activity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceActivity <= 7
    }).slice(0, 5), // Show 5 most recent
  }

  const totalNeedingAttention =
    categorizedJobs.overdue.length +
    categorizedJobs.dueToday.length +
    categorizedJobs.dueSoon.length

  const emailIntegration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  return (
    <div className="size-full flex dark">
      <Sidebar />
      <SimpleTopBar showEmailNotification={!emailIntegration} />
      <div
        className="flex-1 flex flex-col bg-muted/10"
        style={{ marginLeft: '4rem' }}
      >
        <div className="flex-1 overflow-auto pt-[88px]">
          <div className="max-w-[1600px] mx-auto px-8 py-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Today</h1>
              <p className="text-foreground/60 mt-1">
                {totalNeedingAttention === 0
                  ? "You're all caught up!"
                  : `${totalNeedingAttention} ${
                      totalNeedingAttention === 1 ? 'job needs' : 'jobs need'
                    } attention`}
              </p>
            </div>

            {/* Status Counter Widget */}
            <div className="mb-8">
              <StatusStats counts={statusCounts} />
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
                      <tr key={activity.id} className="border-b last:border-0 hover:bg-accent/50">
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
                      <tr key={job.id} className="border-b last:border-0 hover:bg-accent/50">
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
                      <tr key={job.id} className="border-b last:border-0">
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
                      <tr key={job.id} className="border-b last:border-0">
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
                      <tr key={job.id} className="border-b last:border-0">
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
                      <tr key={job.id} className="border-b last:border-0">
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
    </div>
    </div>
    )
  }