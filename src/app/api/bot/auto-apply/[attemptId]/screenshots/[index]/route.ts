import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createSignedStorageUrl,
  RESUME_BUCKET,
  storageObjectPath,
} from '@/lib/supabase/private-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attemptId: string; index: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { attemptId, index } = await params
  const screenshotIndex = Number.parseInt(index, 10)
  if (!Number.isInteger(screenshotIndex) || screenshotIndex < 0) {
    return NextResponse.json({ error: 'Invalid screenshot index' }, { status: 400 })
  }

  const attempt = await prisma.applicationAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    select: { screenshots: true },
  })

  if (!attempt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const storedValue = attempt.screenshots[screenshotIndex]
  const objectPath = storedValue ? storageObjectPath(storedValue, RESUME_BUCKET) : null
  if (!objectPath) {
    return NextResponse.json({ error: 'Screenshot unavailable' }, { status: 404 })
  }

  try {
    const signedUrl = await createSignedStorageUrl(objectPath, `apply-preview-${screenshotIndex + 1}.png`)
    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error('[api/bot/auto-apply/[attemptId]/screenshots/[index]] signed URL failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not open screenshot' }, { status: 502 })
  }
}
