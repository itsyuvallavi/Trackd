import { prisma } from '@/lib/prisma'
import { TEMP_USER_ID } from '@/lib/constants'
import { JobRow } from '@/components/job-row'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const today = new Date()
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(today.getDate() + 7)

  // Get jobs that need attention
  const jobs = await prisma.job.findMany({
    where: {
      userId: TEMP_USER_ID,
      status: {
        in: ['SAVED', 'APPLIED', 'INTERVIEW'], // Active statuses only
      },
    },
    include: {
      activities: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  // Categorize jobs by urgency
  const categorizedJobs = {
    overdue: jobs.filter(job => {
      if (!job.nextAction) return false
      // Jobs saved more than 7 days ago without follow-up
      const daysSinceSaved = Math.floor((today.getTime() - job.savedAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceSaved > 7 && job.status === 'SAVED'
    }),
    dueToday: jobs.filter(job => {
      if (!job.interviewAt) return false
      const interviewDate = new Date(job.interviewAt)
      return interviewDate.toDateString() === today.toDateString()
    }),
    dueSoon: jobs.filter(job => {
      const daysSinceSaved = Math.floor((today.getTime() - job.savedAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceSaved >= 3 && daysSinceSaved <= 7 && job.status === 'SAVED'
    }),
    recentlyApplied: jobs.filter(job => {
      if (!job.appliedAt) return false
      const daysSinceApplied = Math.floor((today.getTime() - job.appliedAt.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceApplied <= 7
    }),
  }

  const totalNeedingAttention =
    categorizedJobs.overdue.length +
    categorizedJobs.dueToday.length +
    categorizedJobs.dueSoon.length

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Today</h1>
          <p className="text-foreground/60 mt-1">
            {totalNeedingAttention === 0
              ? "You're all caught up!"
              : `${totalNeedingAttention} ${totalNeedingAttention === 1 ? 'job needs' : 'jobs need'} attention`}
          </p>
        </div>

        <div className="space-y-8">
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
                      <JobRow key={job.id} job={job} />
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
                      <JobRow key={job.id} job={job} />
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
                      <JobRow key={job.id} job={job} />
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
                      <JobRow key={job.id} job={job} />
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
              <Link href="/jobs/new-url">
                <Button>Add Another Job</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
