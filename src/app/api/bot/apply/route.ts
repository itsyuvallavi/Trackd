import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { BotQueueActionError, markBotQueueJobApplied } from '@/lib/bot/queue-actions'

export async function POST(req: NextRequest) {
  const user = await requireAuth()

  const { jobId } = await req.json() as { jobId: string }
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  try {
    const updated = await markBotQueueJobApplied(user.id, jobId)

    return NextResponse.json({ success: true, job: updated })
  } catch (error) {
    if (error instanceof BotQueueActionError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          existingId: error.existingId,
        },
        { status: error.status },
      )
    }

    throw error
  }
}
