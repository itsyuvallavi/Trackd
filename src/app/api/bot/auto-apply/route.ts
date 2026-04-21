/**
 * POST /api/bot/auto-apply
 * Creates an ApplicationAttempt and starts the browser fill asynchronously.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { detectATS } from '@/lib/bot/ats-detector'
import { runApplicationFill } from '@/lib/bot/apply/apply-orchestrator'
import { isApplyBrowserConfigured } from '@/lib/bot/apply/browser'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isApplyBrowserConfigured()) {
      return NextResponse.json(
        {
          error:
            'Browser automation not configured: set BROWSERLESS_API_KEY (or BROWSERLESS_TOKEN), or BROWSER_APPLY_CHROME_LOCAL=1 (launched Chrome), or BROWSER_APPLY_CHROME_ATTACH=1 (attach to your running Chrome with CHROME_CDP_URL).',
        },
        { status: 503 }
      )
    }

    let body: { jobId?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const jobId = body.jobId
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { id: true, url: true, title: true, company: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!job.url) return NextResponse.json({ error: 'Job has no URL' }, { status: 400 })

    const atsType = detectATS(job.url)

    const attempt = await prisma.applicationAttempt.create({
      data: {
        userId: user.id,
        jobId,
        atsType,
        status: 'filling',
      },
    })

    const result = await runApplicationFill(attempt.id, user.id, jobId)

    return NextResponse.json({
      attemptId: attempt.id,
      ...result,
    })
  } catch (err) {
    console.error('[api/bot/auto-apply] POST', err)
    const message =
      err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
