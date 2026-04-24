import { STATUS_LABELS, STATUS_DOT_COLOR } from '@/lib/constants'
import { AppShell } from '@/components/layout/app-shell'
import { StatusStats } from '@/components/dashboard/status-stats'
import { GlassPanel, GlassPill, Aurora } from '@/components/ui/glass'
import { JobStatus } from '@prisma/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Sunrise, Sun, Moon, Sparkles } from 'lucide-react'
import { requireAuth } from '@/lib/auth'
import { getTodayPageData } from '@/lib/cached-queries'

export const revalidate = 30

type TimeOfDay = 'morning' | 'afternoon' | 'evening'

const BUCKETS: { id: TimeOfDay; label: string; icon: typeof Sunrise }[] = [
  { id: 'morning', label: 'Morning', icon: Sunrise },
  { id: 'afternoon', label: 'Afternoon', icon: Sun },
  { id: 'evening', label: 'Evening', icon: Moon },
]

export default async function TodayPage() {
  const user = await requireAuth()
  const { statusCountsMap, byBucket, totalNeedingAttention } =
    await getTodayPageData(user.id)

  return (
    <AppShell>
      <div className="relative flex-1 overflow-auto">
        {/* Ambient aurora behind the page chrome */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          <Aurora />
        </div>

        <div className="relative z-10 max-w-[1160px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-8">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">Today</h1>
            <p className="text-sm text-muted-foreground">
              {totalNeedingAttention === 0
                ? "You're all caught up."
                : `${totalNeedingAttention} ${
                    totalNeedingAttention === 1 ? 'job needs' : 'jobs need'
                  } your attention.`}
            </p>
          </header>

          <StatusStats counts={statusCountsMap} />

          {/* Single glass canvas holding the time-of-day groups */}
          <GlassPanel className="p-5 md:p-7 rounded-3xl">
            {totalNeedingAttention === 0 ? (
              <EmptyStateAllCaughtUp />
            ) : (
              <div className="space-y-8">
                {BUCKETS.map((bucket) => {
                  const bucketItems = byBucket[bucket.id]
                  if (bucketItems.length === 0) return null
                  const BucketIcon = bucket.icon
                  return (
                    <section key={bucket.id} aria-labelledby={`bucket-${bucket.id}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <BucketIcon className="size-4 text-muted-foreground" />
                        <h2
                          id={`bucket-${bucket.id}`}
                          className="text-sm font-medium tracking-wide uppercase text-muted-foreground"
                        >
                          {bucket.label}
                        </h2>
                        <GlassPill variant="subtle" className="ml-1 text-[10px] tabular-nums">
                          {bucketItems.length}
                        </GlassPill>
                      </div>
                      <ul className="space-y-2">
                        {bucketItems.map(({ job, reason }) => (
                          <li key={`${job.id}-${reason}`}>
                            <Link
                              href={`/jobs/${job.id}`}
                              className={cn(
                                'glass glass-subtle rounded-2xl px-3 py-3 flex items-center gap-3',
                                'transition-[transform,box-shadow] duration-150 ease-[var(--ease-ios)]',
                                'hover:-translate-y-0.5 group'
                              )}
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  'w-[3px] h-10 rounded-full shrink-0',
                                  STATUS_DOT_COLOR[job.status]
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors"
                                    style={{ viewTransitionName: `job-title-${job.id}` }}
                                  >
                                    {job.title}
                                  </span>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {job.company}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {reason}
                                </p>
                              </div>
                              <GlassPill
                                variant="subtle"
                                className="hidden sm:inline-flex text-[10px]"
                              >
                                <span
                                  aria-hidden
                                  className={cn(
                                    'inline-block size-1.5 rounded-full',
                                    STATUS_DOT_COLOR[job.status as JobStatus]
                                  )}
                                />
                                {STATUS_LABELS[job.status as JobStatus]}
                              </GlassPill>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </AppShell>
  )
}

function EmptyStateAllCaughtUp() {
  return (
    <div className="text-center py-16 px-6">
      <div className="mx-auto size-12 rounded-full grid place-items-center bg-primary/10 text-primary mb-4">
        <Sparkles className="size-5" />
      </div>
      <h3 className="text-lg font-medium tracking-tight mb-1">All caught up</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
        No jobs need immediate attention. Keep the momentum by adding another
        role or reviewing your board.
      </p>
      <Link href="/jobs">
        <Button className="rounded-full">Add another job</Button>
      </Link>
    </div>
  )
}
