import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { TEMP_USER_ID } from '@/lib/constants'
import { AddJobModal } from '@/components/add-job-modal'
import { JobRow } from '@/components/job-row'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    where: { userId: TEMP_USER_ID },
    include: {
      activities: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Job Applications</h1>
            <p className="text-foreground/60 mt-1">
              {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} tracked
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/jobs/new-url">
              <Button variant="secondary">Add from URL</Button>
            </Link>
            <AddJobModal />
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-16 border border-foreground/20 rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-foreground/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium">No jobs yet</h3>
            <p className="mt-2 text-foreground/60">
              Get started by adding your first job application.
            </p>
            <div className="mt-6">
              <AddJobModal />
            </div>
          </div>
        ) : (
          <div className="border border-foreground/20 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-foreground/5 border-b border-foreground/20">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                    Next Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider w-20"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
