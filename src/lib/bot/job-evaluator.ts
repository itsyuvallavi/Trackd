/**
 * AI job evaluator.
 * Scores a job 0-100 based on how well it matches the user's BotConfig preferences.
 * Uses GPT-4o-mini for cost efficiency.
 */

import { getAIClient } from '@/lib/ai/client'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult, JobEvaluation } from './types'

const EVALUATOR_MODEL = 'gpt-4o-mini'

function buildEvalPrompt(job: SearchJobResult, config: BotConfig): string {
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

  return `You are evaluating job listings for a job seeker. Score this job and determine if they should apply.

USER PREFERENCES:
${prefs}

JOB LISTING:
${jobInfo}

Respond with a JSON object:
{
  "score": <0-100>,
  "reasoning": "<1-2 sentence explanation>",
  "shouldApply": <true|false>,
  "flags": ["<flag1>", "<flag2>"]
}

Score guide: 80-100 = excellent match, 60-79 = good match, 40-59 = possible but weak, 0-39 = poor match.
Flags should include relevant labels like: "good_match", "salary_too_low", "overqualified", "underqualified", "wrong_location", "remote_friendly", "requires_visa", "contract_only".
shouldApply = true when score >= 60.`
}

export async function evaluateJob(
  job: SearchJobResult,
  config: BotConfig
): Promise<JobEvaluation> {
  const ai = getAIClient()

  const prompt = buildEvalPrompt(job, config)

  const response = await ai.chatCompletion(
    [{ role: 'user', content: prompt }],
    { model: EVALUATOR_MODEL, temperature: 0.2, responseFormat: 'json_object' }
  )

  const raw = response.data.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as Partial<JobEvaluation>

  return {
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0,
    reasoning: parsed.reasoning || '',
    shouldApply: parsed.shouldApply ?? false,
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
  }
}
