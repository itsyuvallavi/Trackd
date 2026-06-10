import { NextResponse } from 'next/server'
import { BotRunStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isStaleRunningBotRun, staleRunningBotRunErrors } from '@/lib/bot/run-staleness'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const run = await prisma.botRun.findFirst({
    where: {
      userId: user.id,
      status: BotRunStatus.RUNNING,
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      status: true,
      source: true,
      jobsFound: true,
      jobsNew: true,
      jobsEvaluated: true,
      jobsApproved: true,
      startedAt: true,
      duration: true,
    },
  })

  if (!run) {
    return NextResponse.json({ run: null })
  }

  if (isStaleRunningBotRun(run.startedAt)) {
    await prisma.botRun.updateMany({
      where: {
        id: run.id,
        userId: user.id,
        status: BotRunStatus.RUNNING,
      },
      data: {
        status: BotRunStatus.FAILED,
        completedAt: new Date(),
        duration: Date.now() - run.startedAt.getTime(),
        errors: staleRunningBotRunErrors(),
      },
    })

    return NextResponse.json({ run: null })
  }

  return NextResponse.json({
    run: {
      ...run,
      startedAt: run.startedAt.toISOString(),
    },
  })
}
