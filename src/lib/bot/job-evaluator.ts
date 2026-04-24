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
import type { GeoMismatchClampMeta } from './geo-mismatch-clamp'
import { applyGeoMismatchClamp } from './geo-mismatch-clamp'
import type { SeniorityClampMeta } from './seniority-clamp'
import { applySeniorityClamp } from './seniority-clamp'
import { buildSmartJdExcerpt, type JdFacts } from './jd-excerpt'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult, JobEvaluation } from './types'
import type { ResumeStructuredData } from './resume/types'
import { parseUserLocations } from './user-locations'
import { preFilterJob } from './pre-filter'

const EVALUATOR_MODEL = 'gpt-5-mini'

const EVALUATOR_SYSTEM_PROMPT = `You score job listings for a specific candidate. Be strict. Prefer false negatives (rejecting a maybe-good job) over false positives (recommending a wrong job), because the user manually reviews every job you save.

Your ONE job: assess whether the job description's required skills and experience match the candidate's resume and stated keywords. Location and seniority have already been verified by a separate deterministic system before you were called — do NOT re-evaluate them.

Rules:
1. Score based on SKILL and EXPERIENCE FIT only. Assume location and seniority are already acceptable — they have been pre-checked.
2. If the description mandates a primary technology ecosystem the candidate's resume does not mention (e.g. N+ years of a specific language/framework), score below 45 unless it is marked optional / "nice to have".
3. If the description mandates a spoken language NOT in the candidate's language list, it is a significant negative.
4. Do not inflate the score just because the job title matches keywords — the description must also align.
5. If the description is short or empty: score from the Title and Company. A title with the user's keywords from a company in their target region is a 76–80. Only go below 50 if the title clearly signals a wrong primary stack (e.g. "PHP Developer" when the resume only shows React/TS).
6. Never penalise on location or seniority — those are handled elsewhere.

Your "reasoning" MUST cite at least one concrete phrase from the description, title, or company. If you cannot cite one, cap the score at 40.`

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
  /** When JD mandates a location / visa / clearance that conflicts with the user's remote preference. */
  geoMismatchClamp?: GeoMismatchClampMeta
  /** When JD's required seniority conflicts with the user's experienceLevel setting. */
  seniorityClamp?: SeniorityClampMeta
  /** Structured facts extracted from the FULL JD (audit + UI). */
  jdFacts?: JdFacts
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
  const userLocations = config.locations.filter(Boolean)
  const parsedLoc = parseUserLocations(userLocations)

  // Build a human-readable location line. Expand "Europe" and "EU" inline so the
  // LLM sees the specific country names and cannot string-match against "Italy" or
  // "Netherlands" and conclude they are outside the user's list.
  let locationDisplay: string
  if (userLocations.length === 0) {
    locationDisplay = 'Any'
  } else {
    const expandedParts = userLocations.map((loc) => {
      const lower = loc.toLowerCase().trim()
      if (lower === 'europe' || lower === 'emea' || lower === 'remote europe' || lower === 'remote emea') {
        return (
          loc +
          ' (= ALL European countries: Germany, France, Spain, Italy, UK/England/Scotland/Wales, ' +
          'Netherlands, Belgium, Ireland, Sweden, Norway, Denmark, Finland, Poland, Austria, ' +
          'Switzerland, Czechia/Czech Republic, Romania, Hungary, Greece, Bulgaria, Croatia, ' +
          'Serbia, Portugal, Lithuania, Latvia, Estonia, Slovakia, Slovenia, Luxembourg, Malta, ' +
          'Cyprus, Iceland, and every other European nation and city therein)'
        )
      }
      if (lower === 'eu') {
        return (
          'EU (= all EU member states: Germany, France, Spain, Italy, Netherlands, Belgium, ' +
          'Ireland, Sweden, Denmark, Finland, Poland, Austria, Czechia, Romania, Hungary, ' +
          'Greece, Bulgaria, Croatia, Slovenia, Slovakia, Estonia, Latvia, Lithuania, ' +
          'Luxembourg, Malta, Cyprus, Portugal)'
        )
      }
      return loc
    })
    locationDisplay = expandedParts.join(', ')
  }

  const prefs = [
    `Target roles/keywords: ${config.keywords.join(', ') || '(none set)'}`,
    `Target locations (authoritative — if empty the user accepts anywhere):\n  ${locationDisplay}`,
    `Remote only: ${config.remoteOnly ? 'Yes' : 'No'}`,
    config.experienceLevel
      ? `Experience level preference: ${config.experienceLevel}`
      : `Experience level preference: Any`,
    config.salaryMin ? `Minimum salary: $${config.salaryMin.toLocaleString()}/year` : null,
    config.excludeCompanies.length > 0 ? `Excluded companies: ${config.excludeCompanies.join(', ')}` : null,
    config.excludeKeywords.length > 0 ? `Excluded description keywords: ${config.excludeKeywords.join(', ')}` : null,
    config.spokenLanguages?.length
      ? `Languages the candidate speaks (postings that *require* other spoken languages as mandatory are a poor fit): ${config.spokenLanguages.join(', ')}`
      : `Spoken languages: (none set)`,
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
  ].join('\n')

  const minScore = config.minScore
  const jd = buildSmartJdExcerpt(job.description)
  // Compact verbatim list for the bottom reminder line
  const locationsDisplay = userLocations.length > 0 ? userLocations.join(', ') : 'Any'

  return `You are evaluating job listings for a job seeker. Score this job 0-100 and decide if they should apply.

Treat the USER PREFERENCES block below as the source of truth about what the user wants. Do not invent preferences (country, continent, stack) that aren't stated there.

USER PREFERENCES:
${prefs}
${resumeSection}
SKILL FIT (your only job):
- If the posting mandates a primary ecosystem (e.g. N+ years of a specific language/framework) the candidate resume does not mention, score below 45 unless the posting clearly marks it optional / "nice to have".
- Do not inflate the score because the title matches the user's keywords when the core bullets demand a different stack.
- Language requirements labeled mandatory for languages NOT in the candidate's spoken-language list are a major negative. If the user listed no spoken languages, do not penalise on language.
- Do NOT flag or score-down on location or seniority — those have already been verified in code before you were called.

JOB LISTING:
${jobInfo}

${jd.excerpt}

Respond with ONLY a JSON object:
{
  "score": <0-100 based on SKILL FIT only>,
  "reasoning": "<2-3 sentences about skill/experience match. MUST quote at least one concrete phrase from the description or title. If you cannot quote one, cap at 40.>",
  "shouldApply": <true only if score >= ${minScore}>,
  "flags": ["<relevant flags>"],
  "resumeMatch": "<which specific skills/experience from the resume are most relevant, or 'no resume' if none>"
}

Score guide: 80-100 strong skill match, 60-79 reasonable match, 40-59 partial/uncertain, 0-39 wrong primary stack.
Flags (skill-related only): good_match, salary_too_low, stack_mismatch, missing_required_language, remote_friendly, requires_visa, contract_only, career_change.
Do NOT use wrong_location, overqualified, or underqualified — those are already handled by code before this call.`
}

function buildScoringInputsSnapshot(
  job: SearchJobResult,
  config: BotConfig,
  resume: ResumeStructuredData | null,
  resumeMeta: { id: string | null; label: string | null }
): ScoringInputsSnapshot {
  const jd = buildSmartJdExcerpt(job.description)
  const desc = jd.excerpt
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
    jdFacts: jd.facts,
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
  // ── Deterministic pre-filter (runs before the LLM) ──────────────────────
  // Hard yes/no rules that are 100% reliable. The LLM is unreliable for
  // geography and seniority checks — code is not.
  const preFilter = preFilterJob(job, config)
  if (preFilter.rejected) {
    const evaluation: JobEvaluation = {
      score: preFilter.score,
      reasoning: preFilter.reason,
      shouldApply: false,
      flags: [preFilter.flag],
    }
    // Build minimal scoringInputs for audit trail (no resume load needed)
    const minimalInputs: ScoringInputsSnapshot = {
      model: 'pre-filter',
      minScoreThreshold: config.minScore,
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
      resumeUsed: { resumeId: null, label: null, selection: 'none', skillsSentToPrompt: [], summaryIncluded: false, experienceRolesInPrompt: 0, educationRowsInPrompt: 0 },
      jobBlockSentToModel: {
        title: job.title,
        company: job.company,
        location: job.location || 'Not specified',
        remote: job.is_remote ? 'Yes' : job.is_remote === false ? 'No' : 'Not specified',
        salaryLine: 'Not listed',
        jobType: job.job_type || 'Not specified',
        descriptionCharCount: (job.description || '').length,
        descriptionPreview: '',
      },
    }
    return { evaluation, scoringInputs: minimalInputs }
  }

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
    { model: EVALUATOR_MODEL, responseFormat: 'json_object', maxTokens: 1500 }
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

  const geoClamp = applyGeoMismatchClamp(job, config, evaluation, threshold)
  evaluation = geoClamp.evaluation
  if (geoClamp.clampMeta) {
    scoringInputsFinal = { ...scoringInputsFinal, geoMismatchClamp: geoClamp.clampMeta }
  }

  const seniorityClamp = applySeniorityClamp(job, config, evaluation, threshold)
  evaluation = seniorityClamp.evaluation
  if (seniorityClamp.clampMeta) {
    scoringInputsFinal = { ...scoringInputsFinal, seniorityClamp: seniorityClamp.clampMeta }
  }

  // Binary gate: if every deterministic clamp passed (none fired a hard cap) and
  // the LLM's raw score is ≥ 40 (i.e. no strong "totally wrong job" signal), bump
  // the score to minScore + 1 so it reaches the queue for manual review.
  // The deterministic clamps are the authoritative yes/no on location, seniority,
  // stack, language, and US-only signals. A fuzzy LLM score of 70 vs 76 is noise —
  // it should not be the deciding factor after all binary checks have passed.
  const anyClampFired =
    !!stackClamp.clampMeta?.applied ||
    !!langClamp.clampMeta?.applied ||
    !!geoClamp.clampMeta?.applied ||
    !!seniorityClamp.clampMeta?.applied

  if (!anyClampFired && evaluation.score >= 40 && evaluation.score < threshold) {
    const boostedScore = threshold + 1
    evaluation = {
      ...evaluation,
      score: boostedScore,
      shouldApply: true,
      flags: [...evaluation.flags, 'clamp_pass_boost'],
      reasoning:
        evaluation.reasoning +
        ' [All deterministic checks passed (location, seniority, stack, language). Score boosted for manual review.]',
    }
  }

  return {
    evaluation,
    scoringInputs: scoringInputsFinal,
  }
}
