import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { BotQueueActionError, skipBotQueueJob } from '@/lib/bot/queue-actions'

export async function POST(req: NextRequest) {
  const user = await requireAuth()

  const { jobId } = await req.json() as { jobId: string }
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  try {
    await skipBotQueueJob(user.id, jobId)

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
