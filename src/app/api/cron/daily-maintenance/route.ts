import { NextResponse } from 'next/server'
import { archiveInactiveJobsForAllUsers } from '@/lib/auto-archive'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { runScheduledBotSearch } from '@/lib/bot/scheduled-bot-search'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  try {
    if (!isCronRequestAuthorized(request.headers)) {
      console.error('Unauthorized daily maintenance cron access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const autoArchiveEnabled = process.env.AUTO_ARCHIVE_ENABLED !== 'false'
    const daysSinceUpdate = parseInt(process.env.AUTO_ARCHIVE_DAYS || '21', 10)

    let archive:
      | {
          enabled: true
          daysSinceUpdate: number
          totalUsersProcessed: number
          totalJobsArchived: number
          totalErrors: number
        }
      | {
          enabled: false
          message: string
        }

    if (autoArchiveEnabled) {
      const result = await archiveInactiveJobsForAllUsers(daysSinceUpdate)
      const totalErrors = Object.values(result.resultsByUser).reduce(
        (sum, r) => sum + r.errors.length,
        0,
      )
      archive = {
        enabled: true,
        daysSinceUpdate,
        totalUsersProcessed: result.totalUsersProcessed,
        totalJobsArchived: result.totalJobsArchived,
        totalErrors,
      }
    } else {
      archive = {
        enabled: false,
        message: 'Auto-archive is disabled',
      }
    }

    const botSearch = await runScheduledBotSearch()

    return NextResponse.json(
      {
        success: botSearch.status < 500,
        archive,
        botSearch: botSearch.body,
      },
      { status: botSearch.status >= 500 ? botSearch.status : 200 },
    )
  } catch (error) {
    console.error('Daily maintenance cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
