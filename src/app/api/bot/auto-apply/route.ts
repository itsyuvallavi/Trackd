/**
 * POST /api/bot/auto-apply
 * Creates an ApplicationAttempt and starts the browser fill asynchronously.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { detectATS } from '@/lib/bot/ats-detector'
import { runApplicationFill } from '@/lib/bot/apply/apply-orchestrator'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const user = await requireAuth()

  if (!process.env.BROWSERLESS_API_KEY) {
    return NextResponse.json({ error: 'Browser automation not configured (BROWSERLESS_API_KEY missing)' }, { status: 503 })
  }

  const { jobId } = await req.json() as { jobId: string }
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: user.id },
    select: { id: true, url: true, title: true, company: true },
  })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.url) return NextResponse.json({ error: 'Job has no URL' }, { status: 400 })

  const atsType = detectATS(job.url)

  // Create the attempt record
  const attempt = await prisma.applicationAttempt.create({
    data: {
      userId: user.id,
      jobId,
      atsType,
      status: 'filling',
    },
  })

  // Run fill synchronously (Vercel waits up to maxDuration=300s)
  const result = await runApplicationFill(attempt.id, user.id, jobId)

  return NextResponse.json({
    attemptId: attempt.id,
    ...result,
  })
}
