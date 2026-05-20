/**
 * Resume parser: extracts structured data from a PDF resume using OpenAI.
 *
 * Flow:
 * 1. Upload PDF to OpenAI Files API
 * 2. Send to GPT-4o with extraction prompt → get structured JSON
 * 3. Delete the temp OpenAI file
 * 4. Return structured data + raw text
 */

import { getAIClient } from '@/lib/ai/client'
import type { ResumeStructuredData } from './types'

export class ResumeParseError extends Error {
  constructor(
    message: string,
    readonly rawText: string | null = null
  ) {
    super(message)
    this.name = 'ResumeParseError'
  }
}

const EXTRACTION_PROMPT = `You are a resume parser. Extract all information from this resume and return it as a single JSON object.

Return exactly this structure (use null for missing fields, empty arrays if none):
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number or null",
  "location": "City, Country or null",
  "linkedin": "LinkedIn URL or null",
  "github": "GitHub URL or null",
  "portfolio": "portfolio URL or null",
  "summary": "professional summary or null",
  "skills": ["skill1", "skill2"],
  "languages": ["English", "Spanish"],
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "startDate": "Month Year",
      "endDate": "Month Year or Present",
      "description": "role description",
      "achievements": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "startDate": "Year",
      "endDate": "Year",
      "gpa": "3.8 or null"
    }
  ],
  "certifications": ["cert1", "cert2"]
}

Return ONLY the JSON. No explanation, no markdown fences.`

export async function parseResumePdf(
  fileBuffer: Buffer,
  fileName: string
): Promise<{ structured: ResumeStructuredData; rawText: string }> {
  const ai = getAIClient()
  const openai = ai.getOpenAIClient()

  // Upload PDF to OpenAI Files API
  const uint8 = new Uint8Array(fileBuffer)
  const file = new File([uint8], fileName, { type: 'application/pdf' })

  const uploaded = await openai.files.create({ file, purpose: 'assistants' })

  // Wait for processing
  let status = await openai.files.retrieve(uploaded.id)
  let attempts = 0
  while (status.status !== 'processed' && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000))
    status = await openai.files.retrieve(uploaded.id)
    attempts++
  }

  if (status.status !== 'processed') {
    await openai.files.delete(uploaded.id).catch(() => {})
    throw new Error('Resume PDF processing timed out on OpenAI')
  }

  // Create a thread with the file attached and extract structured data
  const thread = await openai.beta.threads.create({
    messages: [
      {
        role: 'user',
        content: EXTRACTION_PROMPT,
        attachments: [{ file_id: uploaded.id, tools: [{ type: 'file_search' }] }],
      },
    ],
  })

  // Use a lightweight assistant for extraction
  const assistant = await openai.beta.assistants.create({
    model: 'gpt-4o-mini',
    instructions: 'You are a resume parser. Always respond with pure JSON only.',
    tools: [{ type: 'file_search' }],
  })

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
  })

  // Poll for completion
  let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
  let polls = 0
  while ((runStatus.status === 'queued' || runStatus.status === 'in_progress') && polls < 60) {
    await new Promise((r) => setTimeout(r, 1000))
    runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
    polls++
  }

  if (runStatus.status !== 'completed') {
    throw new Error(`Resume extraction run failed: ${runStatus.status}`)
  }

  // Get the response
  const messages = await openai.beta.threads.messages.list(thread.id)
  const lastMsg = messages.data.find((m) => m.role === 'assistant')
  const rawText = lastMsg?.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: { value: string } }).text.value)
    .join('') ?? ''

  // Clean up OpenAI resources
  await Promise.allSettled([
    openai.files.delete(uploaded.id),
    openai.beta.threads.delete(thread.id),
    openai.beta.assistants.delete(assistant.id),
  ])

  // Parse JSON from response
  let structured: ResumeStructuredData
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    structured = JSON.parse(jsonMatch[0]) as ResumeStructuredData
  } catch {
    throw new ResumeParseError(`Could not parse resume JSON: ${rawText.slice(0, 200)}`, rawText)
  }

  return { structured, rawText }
}

/**
 * Detect which resume persona best matches a job title.
 * Returns the resume whose matchKeywords overlap most with the job title.
 */
export function pickResumeForJob(
  resumes: Array<{ id: string; label: string; matchKeywords: string[]; isDefault: boolean }>,
  jobTitle: string
): string | null {
  if (resumes.length === 0) return null

  const titleLower = jobTitle.toLowerCase()

  let bestId: string | null = null
  let bestScore = 0

  for (const resume of resumes) {
    const score = resume.matchKeywords.filter((kw) =>
      titleLower.includes(kw.toLowerCase())
    ).length

    if (score > bestScore) {
      bestScore = score
      bestId = resume.id
    }
  }

  // Fall back to default resume
  if (!bestId) {
    const defaultResume = resumes.find((r) => r.isDefault) ?? resumes[0]
    bestId = defaultResume?.id ?? null
  }

  return bestId
}
