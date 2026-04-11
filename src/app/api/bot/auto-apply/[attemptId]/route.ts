/**
 * GET  /api/bot/auto-apply/[attemptId]   — poll attempt status
 * POST /api/bot/auto-apply/[attemptId]   — confirm (submit) or cancel
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runApplicationSubmit } from '@/lib/bot/apply/apply-orchestrator'
import { sendMessage } from '@/lib/bot/telegram'

export const maxDuration = 300

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const user = await requireAuth()
  const { attemptId } = await params

  const attempt = await prisma.applicationAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
  })
  if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(attempt)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const user = await requireAuth()
  const { attemptId } = await params
  const { action } = await req.json() as { action: 'confirm' | 'cancel' }

  if (action === 'cancel') {
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
      // Send Telegram notification
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
}
