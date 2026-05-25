import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  BotQueueActionError,
  markBotQueueJobApplied,
  skipBotQueueJob,
} from '@/lib/bot/queue-actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type BulkAction = 'apply' | 'skip'

interface BulkRequestBody {
  action?: BulkAction
  jobIds?: unknown
}

function parseJobIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  )
}

export async function POST(req: NextRequest) {
  const user = await requireAuth()
  const body = (await req.json().catch(() => null)) as BulkRequestBody | null
  const action = body?.action
  const jobIds = parseJobIds(body?.jobIds)

  if (action !== 'apply' && action !== 'skip') {
    return NextResponse.json({ error: 'action must be apply or skip' }, { status: 400 })
  }

  if (jobIds.length === 0) {
    return NextResponse.json({ error: 'jobIds required' }, { status: 400 })
  }

  if (jobIds.length > 100) {
    return NextResponse.json(
      { error: 'Bulk actions are limited to 100 jobs at a time' },
      { status: 400 },
    )
  }

  const succeeded: string[] = []
  const failed: Array<{ jobId: string; error: string; code?: string; existingId?: string }> = []

  for (const jobId of jobIds) {
    try {
      if (action === 'apply') {
        await markBotQueueJobApplied(user.id, jobId)
      } else {
        await skipBotQueueJob(user.id, jobId)
      }
      succeeded.push(jobId)
    } catch (error) {
      if (error instanceof BotQueueActionError) {
        failed.push({
          jobId,
          error: error.message,
          code: error.code,
          existingId: error.existingId,
        })
        continue
      }

      failed.push({
        jobId,
        error: error instanceof Error ? error.message : 'Bulk action failed',
      })
    }
  }

  return NextResponse.json({
    success: failed.length === 0,
    action,
    succeeded,
    failed,
  })
}
