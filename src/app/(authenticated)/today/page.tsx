import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { AppShell } from '@/components/layout/app-shell'
import { StatusStats } from '@/components/dashboard/status-stats'
import { JobStatus } from '@prisma/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getEmailIntegration } from '@/lib/cached-queries'

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
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Minimal queries - only 2 parallel queries to avoid connection pool exhaustion
  const [allJobs, emailIntegration] = await Promise.all([
    prisma.job.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        company: true,
        status: true,
        savedAt: true,
        interviewAt: true,
        nextAction: true,
        appliedAt: true,
      },
      orderBy: { savedAt: 'desc' },
    }),
    getEmailIntegration(user.id),
  ])

  // Compute status counts in JS
  const statusCountsMap: Record<JobStatus, number> = {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  }
  allJobs.forEach(job => {
    statusCountsMap[job.status]++
  })

  // Filter active jobs in JS
  const activeJobs = allJobs.filter(j => ['SAVED', 'APPLIED', 'INTERVIEW'].includes(j.status))

  // For recently applied, check appliedAt in JS
  const recentlyAppliedJobIds = new Set(
    allJobs
      .filter(j => j.appliedAt && new Date(j.appliedAt) >= sevenDaysAgo && j.status === 'APPLIED')
      .map(j => j.id)
  )

  // Categorize jobs by urgency
  const categorizedJobs = {
    overdue: activeJobs.filter(job => {
      if (!job.nextAction) return false
      const daysSinceSaved = Math.floor((today.getTime() - job.savedAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceSaved > 7 && job.status === 'SAVED'
    }),
    dueToday: activeJobs.filter(job => {
      if (job.status !== 'INTERVIEW' || !job.interviewAt) return false
      const interviewDate = new Date(job.interviewAt)
      return interviewDate.toDateString() === today.toDateString()
    }),
    dueSoon: activeJobs.filter(job => {
      const daysSinceSaved = Math.floor((today.getTime() - job.savedAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceSaved >= 3 && daysSinceSaved <= 7 && job.status === 'SAVED'
    }),
    recentlyApplied: activeJobs.filter(job => {
      return recentlyAppliedJobIds.has(job.id) && job.status === 'APPLIED'
    }),
    withNextAction: activeJobs.filter(job => job.nextAction),
  }

  const totalNeedingAttention =
    categorizedJobs.overdue.length +
    categorizedJobs.dueToday.length +
    categorizedJobs.dueSoon.length

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

            {/* Empty State */}
            {totalNeedingAttention === 0 && categorizedJobs.recentlyApplied.length === 0 && categorizedJobs.withNextAction.length === 0 && (
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
