import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAIClient } from '@/lib/ai/client'
import { pickResumeForJob } from '@/lib/bot/resume/parser'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'
import {
  COVER_LETTER_POLISH_SYSTEM_PROMPT,
  COVER_LETTER_SYSTEM_PROMPT,
  buildCoverLetterUserPrompt,
  buildPolishUserPrompt,
  buildResumeSectionForCoverLetter,
} from '@/lib/bot/cover-letter-generation'

const MODEL = 'gpt-4o-mini'

function skipPolishPass(): boolean {
  return process.env.COVER_LETTER_SKIP_POLISH === '1'
}

export async function POST(req: NextRequest) {
  const user = await requireAuth()

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const { jobId, regenerate } = await req.json() as { jobId: string; regenerate?: boolean }
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      notes: true,
      botReasoning: true,
      coverLetter: true,
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Return cached cover letter unless client asks to regenerate
  if (job.coverLetter && !regenerate) {
    return NextResponse.json({ coverLetter: job.coverLetter, cached: true })
  }

  // Load matching resume
  let resume: ResumeStructuredData | null = null
  const resumes = await prisma.botResume.findMany({
    where: { userId: user.id },
    select: { id: true, label: true, matchKeywords: true, isDefault: true, structuredData: true },
  })

  if (resumes.length > 0) {
    const bestId = pickResumeForJob(resumes, job.title)
    const matched = resumes.find((r) => r.id === bestId)
    if (matched?.structuredData) {
      resume = matched.structuredData as unknown as ResumeStructuredData
    }
  }

  const resumeSection = buildResumeSectionForCoverLetter(resume)
  const userPrompt = buildCoverLetterUserPrompt(
    {
      title: job.title,
      company: job.company,
      location: job.location,
      botReasoning: job.botReasoning,
      notes: job.notes,
    },
    resumeSection
  )

  const ai = getAIClient()

  const draftResponse = await ai.chatCompletion(
    [
      { role: 'system', content: COVER_LETTER_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { model: MODEL, temperature: 0.82, responseFormat: 'text' }
  )

  let coverLetter =
    draftResponse.data.choices[0]?.message?.content?.trim() ?? ''

  if (!coverLetter) {
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 })
  }

  if (!skipPolishPass()) {
    const polishResponse = await ai.chatCompletion(
      [
        { role: 'system', content: COVER_LETTER_POLISH_SYSTEM_PROMPT },
        { role: 'user', content: buildPolishUserPrompt(coverLetter) },
      ],
      { model: MODEL, temperature: 0.55, responseFormat: 'text' }
    )

    const polished =
      polishResponse.data.choices[0]?.message?.content?.trim() ?? ''
    if (polished.length > 0) coverLetter = polished
  }

  // Cache the cover letter on the job record
  await prisma.job.update({
    where: { id: jobId },
    data: { coverLetter },
  })

  return NextResponse.json({
    coverLetter,
    cached: false,
    regenerated: Boolean(regenerate),
    polishUsed: !skipPolishPass(),
  })
}
