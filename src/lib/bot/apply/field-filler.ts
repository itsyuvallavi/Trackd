/**
 * AI-powered custom field answerer.
 * Given an unknown form field label, answers it using the user's profile + resume.
 */

import { getAIClient } from '@/lib/ai/client'
import { getApplyFieldModel } from '@/lib/ai/config'
import type { ApplicationProfile } from '@prisma/client'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

export interface FieldContext {
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  options?: string[]     // for select fields or constrained yes/no
  maxLength?: number
}

function isTechnologiesQuestion(label: string): boolean {
  const l = label.toLowerCase()
  return (
    /technolog|framework|language|stack|skill/i.test(l) &&
    /work|used|familiar|experience|know|proficient|with/i.test(l)
  )
}

function technologiesInstructions(): string {
  return `
This field asks for technologies / frameworks / languages the candidate has used.
- Write ONE cohesive paragraph of at least 4 sentences (roughly 120–220 words).
- Name concrete tools from the resume (languages, frameworks, databases, clouds, mobile, CI/CD, etc.).
- Do not reply with a short comma list or a single sentence.
- If the resume is thin, infer only reasonable adjacent skills; otherwise stay grounded in the resume.`
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
  resume: ResumeStructuredData | null,
  opts?: { model?: string }
): Promise<string> {
  const model = opts?.model ?? getApplyFieldModel()
  const profileSummary = profile
    ? [
        profile.applicationFullName ? `Legal name (application): ${profile.applicationFullName}` : null,
        profile.applicationEmail ? `Application email: ${profile.applicationEmail}` : null,
        profile.phone ? `Phone: ${profile.phone}` : null,
        profile.city && profile.state ? `Location: ${profile.city}, ${profile.state}` : null,
        profile.country ? `Country (ISO or name): ${profile.country}` : null,
        profile.workAuthorization ? `Work auth: ${profile.workAuthorization}` : null,
        profile.requiresSponsorship !== null
          ? `Requires sponsorship: ${profile.requiresSponsorship ? 'Yes' : 'No'}`
          : null,
        profile.salaryExpectation
          ? `Salary expectation (annual, from profile — USD unless user noted otherwise): ${profile.salaryExpectation.toLocaleString()}`
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
${resume.summary ? `Summary: ${resume.summary}` : ''}
Skills: ${resume.skills.join(', ')}
Experience: ${resume.experience
        .slice(0, 5)
        .map((e) => `${e.title} at ${e.company}`)
        .join('; ')}
Education: ${resume.education.map((e) => `${e.degree} from ${e.institution}`).join('; ')}
`
    : 'No resume data available.'

  const optionsList = field.options?.length
    ? `\nAllowed values (select one exactly): ${field.options.join(', ')}`
    : ''

  const maxLen = field.maxLength ? `\nMax length: ${field.maxLength} characters.` : ''

  const techBlock =
    field.type === 'textarea' || field.type === 'text'
      ? isTechnologiesQuestion(field.label)
        ? technologiesInstructions()
        : ''
      : ''

  const salaryBlock =
    field.type === 'number' && /eur|€|gross.*year|salary expectation/i.test(field.label)
      ? `
The field is a numeric salary in EUR (gross per year). Convert from the profile figure if it is in USD using a reasonable FX (state the integer only, no symbols or commas), or if conversion is impossible return a plausible EUR integer consistent with the role and profile.`
      : ''

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
${techBlock}${salaryBlock}

Instructions:
- Answer the field concisely and accurately based on the candidate's profile/resume
- For select fields, return ONLY one of the allowed values exactly as written
- For yes/no questions (including when allowed values are listed as Yes/No), return exactly "Yes" or "No" with that capitalization
- For salary fields, return just the number (e.g. "120000")
- For text/textarea, write a professional, specific answer (not generic fluff)
- For "Why do you want to work here?", write 2-3 sentences referencing the company and role
- If you cannot determine the answer from the profile, return an empty string

Return ONLY the answer text, nothing else.`

  const ai = getAIClient()
  const response = await ai.chatCompletion(
    [{ role: 'user', content: prompt }],
    { model, temperature: 0.3, responseFormat: 'text' }
  )

  return response.data.choices[0]?.message?.content?.trim() ?? ''
}
