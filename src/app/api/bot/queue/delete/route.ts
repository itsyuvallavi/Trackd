import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dismissedRowsForUser } from '@/lib/bot/dismissed-job-imports'

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

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      userId: user.id,
      tags: { has: 'bot-approved' },
    },
    select: { url: true, title: true, company: true },
  })

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found or not in bot queue' },
      { status: 404 }
    )
  }

  const rows = dismissedRowsForUser(user.id, job)
  if (rows.length > 0) {
    await prisma.dismissedJobImport.createMany({ data: rows, skipDuplicates: true })
  }

  await prisma.job.deleteMany({
    where: {
      id: jobId,
      userId: user.id,
      tags: { has: 'bot-approved' },
    },
  })

  return NextResponse.json({ success: true })
}
