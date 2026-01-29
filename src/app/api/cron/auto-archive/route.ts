import { NextResponse } from 'next/server'
import { archiveInactiveJobsForAllUsers } from '@/lib/auto-archive'

export const dynamic = 'force-dynamic'

/**
 * Cron endpoint to automatically archive jobs with no email activity
 * 
 * Schedule: Run daily (e.g., "0 2 * * *" = 2 AM daily)
 * 
 * Security: Requires Vercel Cron header or CRON_SECRET Bearer token
 */
export async function GET(request: Request) {
  try {
    // SECURITY: Verify this is called by Vercel Cron or with proper auth
    // Same security model as sync-emails cron
    const vercelCronHeader = request.headers.get('x-vercel-cron')
    const authHeader = request.headers.get('authorization')

    // In production, require either:
    // 1. Vercel Cron header (x-vercel-cron)
    // 2. CRON_SECRET Bearer token
    if (process.env.NODE_ENV === 'production') {
      const hasVercelCron = vercelCronHeader === '1' || request.headers.get('x-vercel-signature')
      const hasValidSecret =
        process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

      if (!hasVercelCron && !hasValidSecret) {
        console.error('Unauthorized auto-archive cron access attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      // In development, allow if CRON_SECRET is provided and matches
      if (process.env.CRON_SECRET) {
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      }
    }

    // Check if auto-archive is enabled (feature flag)
    const autoArchiveEnabled = process.env.AUTO_ARCHIVE_ENABLED !== 'false'
    if (!autoArchiveEnabled) {
      return NextResponse.json({
        message: 'Auto-archive is disabled',
        enabled: false,
      })
    }

    // Get configuration from environment variables (with defaults)
    const daysSinceLastEmail = parseInt(process.env.AUTO_ARCHIVE_DAYS || '30', 10)
    const excludeRecentDays = parseInt(process.env.AUTO_ARCHIVE_EXCLUDE_RECENT_DAYS || '7', 10)

    console.log('🔄 Starting auto-archive cron job...')
    console.log(`   Config: ${daysSinceLastEmail} days since last email, exclude if updated in last ${excludeRecentDays} days`)

    // Archive inactive jobs for all users
    const result = await archiveInactiveJobsForAllUsers(daysSinceLastEmail, excludeRecentDays)

    // Log summary
    console.log(`✅ Auto-archive complete:`)
    console.log(`   Users processed: ${result.totalUsersProcessed}`)
    console.log(`   Jobs archived: ${result.totalJobsArchived}`)

    // Log per-user results if there are any archived jobs
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

    // Log any errors
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
        daysSinceLastEmail,
        excludeRecentDays,
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
