import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAIClient } from '@/lib/ai/client'
import { pickResumeForJob } from '@/lib/bot/resume/parser'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

const MODEL = 'gpt-4o-mini'

export async function POST(req: NextRequest) {
  const user = await requireAuth()

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const { jobId } = await req.json() as { jobId: string }
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

  // Return cached cover letter if already generated
  if (job.coverLetter) {
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

  const resumeSection = resume
    ? `
CANDIDATE DETAILS:
Name: ${resume.name}
${resume.summary ? `Summary: ${resume.summary}` : ''}
Skills: ${resume.skills.slice(0, 25).join(', ')}
Experience:
${resume.experience
  .slice(0, 4)
  .map((e) => `  - ${e.title} at ${e.company} (${e.startDate}–${e.endDate})\n    ${e.description.slice(0, 300)}`)
  .join('\n')}
Education:
${resume.education.map((e) => `  - ${e.degree} in ${e.field ?? 'N/A'} from ${e.institution}`).join('\n')}
`
    : 'No resume available — write a strong general cover letter.'

  const prompt = `Write a professional, concise cover letter for the following job application.

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
${job.botReasoning ? `Why this job matches: ${job.botReasoning}` : ''}
${resumeSection}

GUIDELINES:
- 3–4 paragraphs, no more than 300 words
- Opening: express genuine interest in the role and company
- Middle: highlight 2–3 most relevant experiences/skills from the resume
- Closing: confident call to action
- Tone: professional but warm, not generic
- Do NOT use placeholder text like "[Your Name]" — write as if filling the full letter
- Use the candidate's actual name from the resume${resume?.name ? ` (${resume.name})` : ''}
- Sign off with the candidate's name

Return ONLY the cover letter text, no additional commentary.`

  const ai = getAIClient()
  const response = await ai.chatCompletion(
    [{ role: 'user', content: prompt }],
    { model: MODEL, temperature: 0.7 }
  )

  const coverLetter = response.data.choices[0]?.message?.content?.trim() ?? ''

  if (!coverLetter) {
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 })
  }

  // Cache the cover letter on the job record
  await prisma.job.update({
    where: { id: jobId },
    data: { coverLetter },
  })

  return NextResponse.json({ coverLetter, cached: false })
}
