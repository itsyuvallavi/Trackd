import { NextResponse } from 'next/server'
import { archiveInactiveJobsForAllUsers } from '@/lib/auto-archive'
import { isCronRequestAuthorized } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

/**
 * Cron: archive applications whose Job.updatedAt is older than the threshold (default 21 days).
 */
export async function GET(request: Request) {
  try {
    if (!isCronRequestAuthorized(request.headers)) {
      console.error('Unauthorized auto-archive cron access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const autoArchiveEnabled = process.env.AUTO_ARCHIVE_ENABLED !== 'false'
    if (!autoArchiveEnabled) {
      return NextResponse.json({
        message: 'Auto-archive is disabled',
        enabled: false,
      })
    }

    const daysSinceUpdate = parseInt(process.env.AUTO_ARCHIVE_DAYS || '21', 10)

    console.log('🔄 Starting auto-archive cron job...')
    console.log(`   Config: archive if updatedAt older than ${daysSinceUpdate} days`)

    const result = await archiveInactiveJobsForAllUsers(daysSinceUpdate)

    console.log(`✅ Auto-archive complete:`)
    console.log(`   Users processed: ${result.totalUsersProcessed}`)
    console.log(`   Jobs archived: ${result.totalJobsArchived}`)

    if (result.totalJobsArchived > 0) {
      console.log('\n   Per-user breakdown:')
      for (const [userId, userResult] of Object.entries(result.resultsByUser)) {
        if (userResult.jobsArchived > 0) {
          console.log(`   - User ${userId}: ${userResult.jobsArchived} jobs archived`)
          if (userResult.errors.length > 0) {
            console.log(`     Errors: ${userResult.errors.length}`)
          }
        }
      }
    }

    const totalErrors = Object.values(result.resultsByUser).reduce(
      (sum, r) => sum + r.errors.length,
      0
    )
    if (totalErrors > 0) {
      console.warn(`⚠️  Total errors: ${totalErrors}`)
    }

    return NextResponse.json({
      success: true,
      enabled: true,
      config: {
        daysSinceUpdate,
      },
      results: {
        totalUsersProcessed: result.totalUsersProcessed,
        totalJobsArchived: result.totalJobsArchived,
        totalErrors,
      },
      perUserResults: result.resultsByUser,
    })
  } catch (error) {
    console.error('❌ Auto-archive cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
