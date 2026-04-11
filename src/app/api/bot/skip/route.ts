import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const user = await requireAuth()

  const { jobId } = await req.json() as { jobId: string }
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: user.id },
    select: { id: true, tags: true },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const newTags = job.tags
    .filter((t) => t !== 'bot-approved')
    .concat('bot-skipped')

  await prisma.job.update({
    where: { id: jobId },
    data: {
      tags: { set: newTags },
      activities: {
        create: {
          userId: user.id,
          type: 'NOTE',
          description: 'Skipped from Bot Queue',
        },
      },
    },
  })

  return NextResponse.json({ success: true })
}
