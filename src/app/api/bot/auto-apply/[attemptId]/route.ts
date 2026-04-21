/**
 * GET  /api/bot/auto-apply/[attemptId]   — poll attempt status
 * POST /api/bot/auto-apply/[attemptId]   — confirm (submit) or cancel
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runApplicationSubmit } from '@/lib/bot/apply/apply-orchestrator'
import { sendMessage } from '@/lib/bot/telegram'

export const maxDuration = 300

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attemptId } = await params

    const attempt = await prisma.applicationAttempt.findFirst({
      where: { id: attemptId, userId: user.id },
    })
    if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(attempt)
  } catch (err) {
    console.error('[api/bot/auto-apply/[attemptId]] GET', err)
    const message =
      err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attemptId } = await params

    let body: { action?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const action = body.action

    if (action === 'cancel') {
      const existing = await prisma.applicationAttempt.findFirst({
        where: { id: attemptId, userId: user.id },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      await prisma.applicationAttempt.update({
        where: { id: attemptId },
        data: { status: 'cancelled' },
      })
      return NextResponse.json({ success: true, status: 'cancelled' })
    }

    if (action === 'confirm') {
      const attempt = await prisma.applicationAttempt.findFirst({
        where: { id: attemptId, userId: user.id },
      })
      if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const result = await runApplicationSubmit(attemptId, user.id, attempt.jobId)

      if (result.success) {
        const job = await prisma.job.findFirst({
          where: { id: attempt.jobId },
          select: { title: true, company: true, url: true },
        })
        const config = await prisma.botConfig.findUnique({ where: { userId: user.id } })
        if (config?.telegramChatId && job) {
          await sendMessage(
            config.telegramChatId,
            `Applied to *${job.title}* at *${job.company}* via bot (${attempt.atsType})${job.url ? `\n[View posting](${job.url})` : ''}`
          ).catch(() => {})
        }
      }

      return NextResponse.json({ success: result.success, error: result.error })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[api/bot/auto-apply/[attemptId]] POST', err)
    const message =
      err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
