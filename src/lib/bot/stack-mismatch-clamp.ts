/**
 * Deterministic guardrails when the AI scores a listing too generously:
 * JDs that mandate a stack (e.g. multi-year Java + Spring) while the resume
 * shows no evidence of that stack should not pass the user's threshold.
 */

import type { JobEvaluation, SearchJobResult } from './types'
import type { ResumeStructuredData } from './resume/types'

export type StackMismatchClampMeta = {
  applied: boolean
  beforeScore: number
  afterScore: number
  reasons: string[]
}

/** Match full job description for clamp logic (models may see a truncated slice). */
const JD_CLAMP_MAX_CHARS = 12000

/** When the JD demands this ecosystem but the resume doesn't show it — cap score here. */
const JAVA_ECOSYSTEM_CAP = 34
const ANGULAR_CAP = 38

export function buildResumeSkillsBlob(resume: ResumeStructuredData): string {
  const parts: string[] = []
  if (resume.summary) parts.push(resume.summary)
  parts.push(...resume.skills)
  for (const e of resume.experience) {
    parts.push(e.title, e.company, e.description, ...(e.achievements ?? []))
  }
  for (const ed of resume.education) {
    parts.push(ed.degree, ed.field ?? '', ed.institution)
  }
  return parts.join('\n')
}

/** Word-ish Java, not substring of JavaScript (handled via boundary). */
function resumeEvidenceJavaStack(blob: string): boolean {
  const lower = blob.toLowerCase()
  return (
    /\b(?:java|kotlin)\b/.test(lower) ||
    /\bspring\b/i.test(blob) ||
    /\bhibernate\b/i.test(lower) ||
    /\bjvm\b/i.test(lower)
  )
}

function jdRequiresStrongJava(jdRaw: string): boolean {
  const jd = jdRaw.slice(0, JD_CLAMP_MAX_CHARS).toLowerCase()

  const javaYears =
    /\b\d+\s+years?\s+of\s+experience\s+in\s+java\b/.test(jd) ||
    /\b\d+\s*\+?\s*years?\s+(?:of\s+)?(?:experience\s+)?(?:in|with)\s+java\b/.test(jd) ||
    /\bminimum\s+of\s+\d+\s*years?\s+[^.\n]{0,120}\bjava\b/.test(jd) ||
    /\bat\s+least\s+\d+\s*years?\s+[^.\n]{0,120}\bjava\b/.test(jd) ||
    /\b\d+\+\s*years?\s+[^.\n]{0,80}\bjava\b/.test(jd)

  const javaPlusEnterpriseFramework =
    /\bjava\s+(?:development|applications?|developer|engineer)\b/.test(jd) &&
    /\b(?:spring|hibernate)\b/.test(jd)

  return Boolean(javaYears || javaPlusEnterpriseFramework)
}

function jdMandatoryAngular(jdRaw: string, title: string): boolean {
  const jd = jdRaw.slice(0, JD_CLAMP_MAX_CHARS).toLowerCase()
  if (!jd.includes('angular')) return false

  const titled = title.toLowerCase()
  if (/\bangular\b/.test(titled) && /\b(developer|engineer|programmer)\b/.test(titled)) return true

  return /\b(?:knowledge\s+of|experience\s+with|experience\s+in|proficiency\s+in|proficient\s+in)\s+angular\b/.test(
    jd
  )
}

function resumeEvidenceAngular(blob: string): boolean {
  return /\bangular\b/i.test(blob)
}

export function applyStackMismatchClamp(
  job: SearchJobResult,
  resume: ResumeStructuredData | null,
  evaluation: JobEvaluation,
  minScore: number
): { evaluation: JobEvaluation; clampMeta?: StackMismatchClampMeta } {
  if (!resume || !job.description?.trim()) {
    return { evaluation }
  }

  const jd = job.description
  const blob = buildResumeSkillsBlob(resume)

  let maxAllowed = 100
  const reasons: string[] = []

  if (jdRequiresStrongJava(jd) && !resumeEvidenceJavaStack(blob)) {
    maxAllowed = Math.min(maxAllowed, JAVA_ECOSYSTEM_CAP)
    reasons.push('listing expects Java/Spring-style experience; your resume does not show Java ecosystem skills')
  }

  if (jdMandatoryAngular(jd, job.title) && !resumeEvidenceAngular(blob)) {
    maxAllowed = Math.min(maxAllowed, ANGULAR_CAP)
    reasons.push('listing requires Angular; your resume does not mention Angular')
  }

  if (maxAllowed >= evaluation.score) {
    return { evaluation }
  }

  const beforeScore = evaluation.score
  const afterScore = Math.min(beforeScore, maxAllowed)
  const flags = Array.from(new Set([...evaluation.flags, 'stack_mismatch']))

  const note = ` [Match score adjusted: ${reasons.join('; ')}.]`
  const reasoning =
    evaluation.reasoning && !evaluation.reasoning.includes('Match score adjusted')
      ? `${evaluation.reasoning}${note}`
      : evaluation.reasoning || note.trim()

  return {
    evaluation: {
      ...evaluation,
      score: afterScore,
      shouldApply: afterScore >= minScore,
      flags,
      reasoning,
    },
    clampMeta: {
      applied: true,
      beforeScore,
      afterScore,
      reasons,
    },
  }
}
