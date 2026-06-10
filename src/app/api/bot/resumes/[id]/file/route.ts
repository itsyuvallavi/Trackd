import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
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
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth()
  const { id } = await params

  const resume = await prisma.botResume.findFirst({
    where: { id, userId: user.id },
    select: { fileUrl: true, fileName: true },
  })

  if (!resume) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const objectPath = storageObjectPath(resume.fileUrl, RESUME_BUCKET)
  if (!objectPath) {
    return NextResponse.json({ error: 'Stored file is unavailable' }, { status: 404 })
  }

  try {
    const signedUrl = await createSignedStorageUrl(objectPath, resume.fileName)
    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error('[api/bot/resumes/[id]/file] signed URL failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not open resume file' }, { status: 502 })
  }
}
