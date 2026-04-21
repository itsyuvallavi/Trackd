import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import { parseResumePdf } from '@/lib/bot/resume/parser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/** Object path inside the `resume` bucket from a Supabase Storage public or signed URL. */
function storageResumeObjectPath(fileUrl: string): string | null {
  const raw = fileUrl?.trim()
  if (!raw) return null
  try {
    const pathname = new URL(raw).pathname
    const markers = ['/object/public/resume/', '/object/sign/resume/'] as const
    for (const m of markers) {
      const i = pathname.indexOf(m)
      if (i !== -1) {
        const segment = pathname.slice(i + m.length)
        try {
          return decodeURIComponent(segment)
        } catch {
          return segment
        }
      }
    }
    const parts = pathname.split('/resume/')
    if (parts.length > 1) {
      const segment = parts[parts.length - 1]!
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    }
  } catch {
    return null
  }
  return null
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

// GET /api/bot/resumes — list all resumes for current user
export async function GET() {
  const user = await requireAuth()
  const resumes = await prisma.botResume.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      matchKeywords: true,
      isDefault: true,
      fileName: true,
      fileUrl: true,
      structuredData: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(resumes)
}

// POST /api/bot/resumes — upload a new resume
export async function POST(req: NextRequest) {
  const user = await requireAuth()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const label = (formData.get('label') as string | null)?.trim()
  const matchKeywordsRaw = formData.get('matchKeywords') as string | null
  const isDefault = formData.get('isDefault') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 })

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const matchKeywords = matchKeywordsRaw
    ? matchKeywordsRaw.split(',').map((k) => k.trim()).filter(Boolean)
    : []

  // Upload to Supabase Storage
  const supabase = getSupabaseAdmin()
  const path = `bot-resumes/${user.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('resume')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    console.error('Supabase upload error:', uploadError)
    return NextResponse.json({ error: 'File upload failed', detail: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('resume').getPublicUrl(path)
  const fileUrl = urlData.publicUrl

  // Parse PDF with OpenAI
  let structured = null
  let rawText: string | undefined
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await parseResumePdf(buffer, file.name)
      structured = result.structured
      rawText = result.rawText
    } catch (parseErr) {
      console.warn('Resume parsing failed (non-fatal):', parseErr instanceof Error ? parseErr.message : parseErr)
    }
  }

  // If this is set as default, unset others
  if (isDefault) {
    await prisma.botResume.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    })
  }

  const resume = await prisma.botResume.create({
    data: {
      userId: user.id,
      label,
      matchKeywords,
      isDefault,
      fileUrl,
      fileName: file.name,
      rawText,
      structuredData: structured ? (structured as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
    },
  })

  return NextResponse.json(resume)
}

// DELETE /api/bot/resumes?id=xxx
export async function DELETE(req: NextRequest) {
  const user = await requireAuth()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const resume = await prisma.botResume.findFirst({ where: { id, userId: user.id } })
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const objectPath = storageResumeObjectPath(resume.fileUrl)
    if (objectPath) {
      const supabase = getSupabaseAdmin()
      const { error: removeErr } = await supabase.storage.from('resume').remove([objectPath])
      if (removeErr) {
        console.warn('[api/bot/resumes] Storage remove:', removeErr.message)
      }
    }

    const del = await prisma.botResume.deleteMany({ where: { id, userId: user.id } })
    if (del.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/bot/resumes] DELETE failed:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: 'Delete failed', detail: message }, { status: 500 })
  }
}
