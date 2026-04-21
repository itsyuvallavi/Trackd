/**
 * AI job evaluator.
 * Scores a job 0-100 based on the user's BotConfig and — when available —
 * the resume that best matches the job title.
 */

import { getAIClient } from '@/lib/ai/client'
import { prisma } from '@/lib/prisma'
import { pickResumeForJob } from './resume/parser'
import type { LanguageMismatchClampMeta } from './language-mismatch-clamp'
import {
  applyLanguageMismatchClamp,
  normalizeSpokenLanguageAllowlist,
} from './language-mismatch-clamp'
import type { StackMismatchClampMeta } from './stack-mismatch-clamp'
import { applyStackMismatchClamp } from './stack-mismatch-clamp'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult, JobEvaluation } from './types'
import type { ResumeStructuredData } from './resume/types'

const EVALUATOR_MODEL = 'gpt-4o-mini'

/** Enough chars to include qualifications blocks from typical postings (was 1500). */
const JOB_DESCRIPTION_EVAL_CHARS = 3200

const EVALUATOR_SYSTEM_PROMPT = `You score job listings for a specific candidate. Be skeptical: a matching job title ("Full Stack Developer") does NOT mean a good match if the posting mandates a different primary stack (e.g. years of Java + Spring) than the resume shows (e.g. TypeScript/React).

Penalize heavily when required skills in the description are absent from the resume. Prefer fewer false positives (annoying wrong matches) over marginal fits.

When USER PREFERENCES list languages the candidate speaks, treat any *mandatory* requirement for a different spoken language as a serious mismatch unless the posting clearly marks it optional.`

/** Structured record of what was sent to the model (for BotRunListing.scoringInputs). */
export type ScoringInputsSnapshot = {
  model: string
  minScoreThreshold: number
  userPreferences: {
    keywords: string[]
    locations: string[]
    remoteOnly: boolean
    experienceLevel: string | null
    salaryMin: number | null
    excludeCompanies: string[]
    excludeKeywords: string[]
    spokenLanguages: string[]
  }
  resumeUsed: {
    resumeId: string | null
    label: string | null
    selection: 'matched_by_keywords' | 'none'
    skillsSentToPrompt: string[]
    summaryIncluded: boolean
    experienceRolesInPrompt: number
    educationRowsInPrompt: number
  }
  /** Mirrors the JOB LISTING block in the evaluator prompt (description truncated same as prompt). */
  jobBlockSentToModel: {
    title: string
    company: string
    location: string
    remote: string
    salaryLine: string
    jobType: string
    descriptionCharCount: number
    descriptionPreview: string
  }
  /** When deterministic rules lower the score because required stack ≠ resume (see stack-mismatch-clamp). */
  stackMismatchClamp?: StackMismatchClampMeta
  /** When JD mandates spoken languages outside the user's BotConfig list (see language-mismatch-clamp). */
  languageMismatchClamp?: LanguageMismatchClampMeta
}

export type EvaluateJobResult = {
  evaluation: JobEvaluation
  scoringInputs: ScoringInputsSnapshot
}

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
    config.spokenLanguages?.length
      ? `Languages the candidate speaks (postings that *require* other spoken languages as mandatory are a poor fit): ${config.spokenLanguages.join(', ')}`
      : null,
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
    `Description: ${(job.description || '').slice(0, JOB_DESCRIPTION_EVAL_CHARS)}`,
  ].join('\n')

  const minScore = config.minScore

  return `You are evaluating job listings for a job seeker. Score this job 0-100 and decide if they should apply.

USER PREFERENCES:
${prefs}
${resumeSection}
STACK & MUST-HAVE FIT (critical — read the job description carefully):
- If the posting mandates a **primary ecosystem** (e.g. multiple years of **Java**, **Spring/Hibernate**, **Angular** as a main framework, **.NET/C#**, **native mobile in Swift/Kotlin only**, etc.) and the **candidate resume does not mention** that ecosystem, score **below 45** unless the posting clearly treats it as optional or "nice to have."
- Do **not** inflate the score because the title says "Full Stack" or matches the user's keywords if the **core stack in the bullets** conflicts with their resume (e.g. TS/React resume vs Java+Angular banking role).
- Language requirements labeled **mandatory** for languages **not** in the user's spoken-language list above: treat as a **major** negative. English-only requirements are fine if the user lists English.

GEOGRAPHY & REMOTE (apply strictly when judging location):
- The user is based in the EU (e.g. Portugal) and is happy to work for a US or global company **if the role is fully remote from the EU** (no requirement to live in the US, LATAM-only, or relocate). Do **not** treat "US company" or "US time zones" alone as wrong_location if EU/remote-from-Europe is clearly allowed.
- **Penalize** (wrong_location and/or lower score) when the listing requires **regular on-site or hybrid** in a specific city (e.g. N days per week in London) that is **not a realistic commute** from the user's base — weekly travel to another country is a poor fit even if that city appeared in their search locations by mistake.
- **Still penalize** listings that are **exclusive** to a region the user cannot join: e.g. US-only hiring, LATAM-only, must live in [country] with no full EU remote option.

JOB LISTING:
${jobInfo}

Respond with ONLY a JSON object:
{
  "score": <0-100>,
  "reasoning": "<2-3 sentences explaining the match quality, referencing specific resume experience if available>",
  "shouldApply": <true only if score >= ${minScore} — the user’s minimum match threshold is ${minScore}/100>,
  "flags": ["<relevant flag>"],
  "resumeMatch": "<which specific skills/experience from the resume are most relevant, or 'no resume' if none>"
}

Score guide: 80-100 excellent, 60-79 good, 40-59 possible, 0-39 poor.
The server will only queue jobs for review when score >= ${minScore} (shouldApply must align).
Penalize wrong seniority and **mandatory skill/language mismatches** harshly. For location, follow GEOGRAPHY & REMOTE above — do not over-penalize US employers offering legitimate EU-remote work.
Flags: good_match, salary_too_low, overqualified, underqualified, wrong_location, remote_friendly, requires_visa, contract_only, career_change, stack_mismatch, missing_required_language.`
}

function buildScoringInputsSnapshot(
  job: SearchJobResult,
  config: BotConfig,
  resume: ResumeStructuredData | null,
  resumeMeta: { id: string | null; label: string | null }
): ScoringInputsSnapshot {
  const desc = (job.description || '').slice(0, JOB_DESCRIPTION_EVAL_CHARS)
  return {
    model: EVALUATOR_MODEL,
    minScoreThreshold: Math.max(0, Math.min(100, config.minScore)),
    userPreferences: {
      keywords: [...config.keywords],
      locations: [...config.locations],
      remoteOnly: config.remoteOnly,
      experienceLevel: config.experienceLevel ?? null,
      salaryMin: config.salaryMin ?? null,
      excludeCompanies: [...config.excludeCompanies],
      excludeKeywords: [...config.excludeKeywords],
      spokenLanguages: [...(config.spokenLanguages ?? [])],
    },
    resumeUsed: {
      resumeId: resumeMeta.id,
      label: resumeMeta.label,
      selection: resume ? 'matched_by_keywords' : 'none',
      skillsSentToPrompt: resume ? resume.skills.slice(0, 30) : [],
      summaryIncluded: !!resume?.summary,
      experienceRolesInPrompt: resume ? Math.min(4, resume.experience.length) : 0,
      educationRowsInPrompt: resume ? resume.education.length : 0,
    },
    jobBlockSentToModel: {
      title: job.title,
      company: job.company,
      location: job.location || 'Not specified',
      remote: job.is_remote ? 'Yes' : job.is_remote === false ? 'No' : 'Not specified',
      salaryLine:
        job.salary_min || job.salary_max
          ? `${job.salary_currency || 'USD'} ${job.salary_min?.toLocaleString() ?? '?'}–${job.salary_max?.toLocaleString() ?? '?'}`
          : 'Not listed',
      jobType: job.job_type || 'Not specified',
      descriptionCharCount: (job.description || '').length,
      descriptionPreview: desc,
    },
  }
}

type LoadedResume = {
  resume: ResumeStructuredData | null
  resumeId: string | null
  label: string | null
}

async function loadResumeForEvaluation(
  userId: string,
  jobTitle: string
): Promise<LoadedResume> {
  try {
    const resumes = await prisma.botResume.findMany({
      where: { userId },
      select: { id: true, label: true, matchKeywords: true, isDefault: true, structuredData: true },
    })

    if (resumes.length === 0) {
      return { resume: null, resumeId: null, label: null }
    }

    const bestId = pickResumeForJob(resumes, jobTitle)
    const matched = resumes.find((r) => r.id === bestId)
    if (matched?.structuredData) {
      return {
        resume: matched.structuredData as unknown as ResumeStructuredData,
        resumeId: matched.id,
        label: matched.label,
      }
    }
  } catch (err) {
    console.warn('[evaluator] Could not load resumes:', err instanceof Error ? err.message : err)
  }
  return { resume: null, resumeId: null, label: null }
}

export async function evaluateJob(job: SearchJobResult, config: BotConfig): Promise<EvaluateJobResult> {
  const ai = getAIClient()
  const { resume, resumeId, label } = await loadResumeForEvaluation(config.userId, job.title)
  const resumeMeta = { id: resumeId, label }
  const prompt = buildEvalPrompt(job, config, resume)
  const scoringInputs = buildScoringInputsSnapshot(job, config, resume, resumeMeta)

  const response = await ai.chatCompletion(
    [
      { role: 'system', content: EVALUATOR_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    { model: EVALUATOR_MODEL, temperature: 0.2, responseFormat: 'json_object' }
  )

  const raw = response.data.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as Partial<JobEvaluation> & { resumeMatch?: string }

  const score =
    typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0
  const threshold = Math.max(0, Math.min(100, config.minScore))

  const resumeMatch =
    typeof parsed.resumeMatch === 'string' ? parsed.resumeMatch.slice(0, 2000) : undefined

  let evaluation: JobEvaluation = {
    score,
    reasoning: parsed.reasoning || '',
    shouldApply: score >= threshold,
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    resumeMatch,
  }

  const stackClamp = applyStackMismatchClamp(job, resume, evaluation, threshold)
  evaluation = stackClamp.evaluation

  let scoringInputsFinal: ScoringInputsSnapshot = stackClamp.clampMeta
    ? { ...scoringInputs, stackMismatchClamp: stackClamp.clampMeta }
    : scoringInputs

  const allowedLang = normalizeSpokenLanguageAllowlist(config.spokenLanguages ?? [])
  const langClamp = applyLanguageMismatchClamp(job, evaluation, threshold, allowedLang)
  evaluation = langClamp.evaluation
  if (langClamp.clampMeta) {
    scoringInputsFinal = { ...scoringInputsFinal, languageMismatchClamp: langClamp.clampMeta }
  }

  return {
    evaluation,
    scoringInputs: scoringInputsFinal,
  }
}
