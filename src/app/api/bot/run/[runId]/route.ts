import { NextRequest, NextResponse } from 'next/server'
import { BotRunStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isStaleRunningBotRun, staleRunningBotRunErrors } from '@/lib/bot/run-staleness'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runId } = await params
  const run = await prisma.botRun.findFirst({
    where: {
      id: runId,
      userId: user.id,
    },
    select: {
      id: true,
      status: true,
      source: true,
      jobsFound: true,
      jobsNew: true,
      jobsEvaluated: true,
      jobsApproved: true,
      startedAt: true,
      completedAt: true,
      duration: true,
    },
  })

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  if (run.status === BotRunStatus.RUNNING && isStaleRunningBotRun(run.startedAt)) {
    const completedAt = new Date()
    const duration = Date.now() - run.startedAt.getTime()
    await prisma.botRun.updateMany({
      where: {
        id: run.id,
        userId: user.id,
        status: BotRunStatus.RUNNING,
      },
      data: {
        status: BotRunStatus.FAILED,
        completedAt,
        duration,
        errors: staleRunningBotRunErrors(),
      },
    })

    return NextResponse.json({
      ...run,
      status: BotRunStatus.FAILED,
      completedAt: completedAt.toISOString(),
      duration,
      startedAt: run.startedAt.toISOString(),
    })
  }

  return NextResponse.json({
    ...run,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  })
}
