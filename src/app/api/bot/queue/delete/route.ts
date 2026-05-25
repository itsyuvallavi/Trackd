import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { BotQueueActionError, deleteBotQueueJob } from '@/lib/bot/queue-actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Permanently remove a bot-queue job from Trackd.
 * Only jobs still tagged `bot-approved` can be removed via this endpoint.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth()

  const body = (await req.json().catch(() => null)) as { jobId?: string } | null
  const jobId = body?.jobId?.trim()
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  try {
    await deleteBotQueueJob(user.id, jobId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof BotQueueActionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }

    throw error
  }
}
