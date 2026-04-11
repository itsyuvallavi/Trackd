/**
 * AI-powered custom field answerer.
 * Given an unknown form field label, answers it using the user's profile + resume.
 */

import { getAIClient } from '@/lib/ai/client'
import type { ApplicationProfile } from '@prisma/client'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

const MODEL = 'gpt-4o-mini'

export interface FieldContext {
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  options?: string[]     // for select fields
  maxLength?: number
}

export interface JobContext {
  title: string
  company: string
  description?: string | null
}

export async function answerCustomField(
  field: FieldContext,
  job: JobContext,
  profile: ApplicationProfile | null,
  resume: ResumeStructuredData | null
): Promise<string> {
  const profileSummary = profile
    ? [
        profile.phone ? `Phone: ${profile.phone}` : null,
        profile.city && profile.state ? `Location: ${profile.city}, ${profile.state}` : null,
        profile.workAuthorization ? `Work auth: ${profile.workAuthorization}` : null,
        profile.requiresSponsorship !== null
          ? `Requires sponsorship: ${profile.requiresSponsorship ? 'Yes' : 'No'}`
          : null,
        profile.salaryExpectation
          ? `Salary expectation: $${profile.salaryExpectation.toLocaleString()}/year`
          : null,
        profile.noticePeriod ? `Notice period: ${profile.noticePeriod}` : null,
        profile.yearsExperience ? `Years of experience: ${profile.yearsExperience}` : null,
        profile.linkedinUrl ? `LinkedIn: ${profile.linkedinUrl}` : null,
        profile.githubUrl ? `GitHub: ${profile.githubUrl}` : null,
        profile.portfolioUrl ? `Portfolio: ${profile.portfolioUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : 'No profile data available.'

  const resumeSummary = resume
    ? `
Name: ${resume.name}
Skills: ${resume.skills.slice(0, 20).join(', ')}
Experience: ${resume.experience
        .slice(0, 3)
        .map((e) => `${e.title} at ${e.company}`)
        .join('; ')}
Education: ${resume.education.map((e) => `${e.degree} from ${e.institution}`).join('; ')}
`
    : 'No resume data available.'

  const optionsList = field.options?.length
    ? `\nAllowed values (select one exactly): ${field.options.join(', ')}`
    : ''

  const maxLen = field.maxLength ? `\nMax length: ${field.maxLength} characters.` : ''

  const prompt = `You are filling out a job application form on behalf of a candidate.

JOB:
Title: ${job.title}
Company: ${job.company}
${job.description ? `Description (excerpt): ${job.description.slice(0, 500)}` : ''}

CANDIDATE PROFILE:
${profileSummary}

CANDIDATE RESUME:
${resumeSummary}

FORM FIELD:
Label: "${field.label}"
Type: ${field.type}${optionsList}${maxLen}

Instructions:
- Answer the field concisely and accurately based on the candidate's profile/resume
- For select fields, return ONLY one of the allowed values exactly as written
- For yes/no questions, return "Yes" or "No"
- For salary fields, return just the number (e.g. "120000")
- For text/textarea, write a professional, specific answer (not generic fluff)
- For "Why do you want to work here?", write 2-3 sentences referencing the company and role
- If you cannot determine the answer from the profile, return an empty string

Return ONLY the answer text, nothing else.`

  const ai = getAIClient()
  const response = await ai.chatCompletion(
    [{ role: 'user', content: prompt }],
    { model: MODEL, temperature: 0.3, responseFormat: 'text' }
  )

  return response.data.choices[0]?.message?.content?.trim() ?? ''
}
