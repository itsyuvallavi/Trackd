/**
 * AI job evaluator.
 * Scores a job 0-100 based on the user's BotConfig and — when available —
 * the resume that best matches the job title.
 */

import { getAIClient } from '@/lib/ai/client'
import { prisma } from '@/lib/prisma'
import { pickResumeForJob } from './resume/parser'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult, JobEvaluation } from './types'
import type { ResumeStructuredData } from './resume/types'

const EVALUATOR_MODEL = 'gpt-4o-mini'

function buildEvalPrompt(
  job: SearchJobResult,
  config: BotConfig,
  resume: ResumeStructuredData | null
): string {
  const prefs = [
    `Target roles/keywords: ${config.keywords.join(', ')}`,
    `Target locations: ${config.locations.join(', ') || 'Any'}`,
    `Remote only: ${config.remoteOnly ? 'Yes' : 'No'}`,
    config.experienceLevel ? `Experience level preference: ${config.experienceLevel}` : null,
    config.salaryMin ? `Minimum salary: $${config.salaryMin.toLocaleString()}/year` : null,
    config.excludeCompanies.length > 0 ? `Excluded companies: ${config.excludeCompanies.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const resumeSection = resume
    ? `
CANDIDATE RESUME:
Name: ${resume.name}
Skills: ${resume.skills.slice(0, 30).join(', ')}
${resume.summary ? `Summary: ${resume.summary}` : ''}
Experience:
${resume.experience
  .slice(0, 4)
  .map((e) => `  - ${e.title} at ${e.company} (${e.startDate}–${e.endDate}): ${e.description.slice(0, 200)}`)
  .join('\n')}
Education:
${resume.education.map((e) => `  - ${e.degree} in ${e.field ?? 'N/A'} from ${e.institution}`).join('\n')}
`
    : '\nNo resume uploaded — evaluate based on preferences only.\n'

  const jobInfo = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location || 'Not specified'}`,
    `Remote: ${job.is_remote ? 'Yes' : job.is_remote === false ? 'No' : 'Not specified'}`,
    job.salary_min || job.salary_max
      ? `Salary: ${job.salary_currency || 'USD'} ${job.salary_min?.toLocaleString() ?? '?'}–${job.salary_max?.toLocaleString() ?? '?'}`
      : 'Salary: Not listed',
    `Job type: ${job.job_type || 'Not specified'}`,
    `Description: ${(job.description || '').slice(0, 1500)}`,
  ].join('\n')

  return `You are evaluating job listings for a job seeker. Score this job 0-100 and decide if they should apply.

USER PREFERENCES:
${prefs}
${resumeSection}
JOB LISTING:
${jobInfo}

Respond with ONLY a JSON object:
{
  "score": <0-100>,
  "reasoning": "<2-3 sentences explaining the match quality, referencing specific resume experience if available>",
  "shouldApply": <true if score >= 60>,
  "flags": ["<relevant flag>"],
  "resumeMatch": "<which specific skills/experience from the resume are most relevant, or 'no resume' if none>"
}

Score guide: 80-100 excellent, 60-79 good, 40-59 possible, 0-39 poor.
Flags: good_match, salary_too_low, overqualified, underqualified, wrong_location, remote_friendly, requires_visa, contract_only, career_change.`
}

export async function evaluateJob(
  job: SearchJobResult,
  config: BotConfig
): Promise<JobEvaluation> {
  const ai = getAIClient()

  // Load resumes for this user and pick the best match
  let resume: ResumeStructuredData | null = null
  try {
    const resumes = await prisma.botResume.findMany({
      where: { userId: config.userId },
      select: { id: true, label: true, matchKeywords: true, isDefault: true, structuredData: true },
    })

    if (resumes.length > 0) {
      const bestId = pickResumeForJob(resumes, job.title)
      const matched = resumes.find((r) => r.id === bestId)
      if (matched?.structuredData) {
        resume = matched.structuredData as unknown as ResumeStructuredData
      }
    }
  } catch (err) {
    console.warn('[evaluator] Could not load resumes:', err instanceof Error ? err.message : err)
  }

  const prompt = buildEvalPrompt(job, config, resume)

  const response = await ai.chatCompletion(
    [{ role: 'user', content: prompt }],
    { model: EVALUATOR_MODEL, temperature: 0.2, responseFormat: 'json_object' }
  )

  const raw = response.data.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as Partial<JobEvaluation> & { resumeMatch?: string }

  return {
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0,
    reasoning: parsed.reasoning || '',
    shouldApply: parsed.shouldApply ?? false,
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
  }
}
