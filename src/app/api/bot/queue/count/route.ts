import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { countDedupedBotQueueJobs } from '@/lib/bot/queue-count'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ count: 0, error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = await prisma.job.findMany({
    where: {
      userId: user.id,
      status: 'SAVED',
      tags: { has: 'bot-approved' },
    },
    select: {
      company: true,
      title: true,
    },
  })

  return NextResponse.json({
    count: countDedupedBotQueueJobs(jobs),
  })
}
