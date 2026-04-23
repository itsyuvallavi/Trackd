/**
 * Deterministic guardrail for seniority mismatch between the user's preferred
 * experience level (BotConfig.experienceLevel) and the JD's evident seniority.
 *
 *   mid / entry / internship vs "Staff / Principal / 10+ yrs"   → cap, underqualified
 *   senior / director          vs "Intern / Fresher / Junior"   → cap, overqualified
 *
 * Purely regex-based. The evaluator has the same info but may still over-score.
 */

import type { BotConfig } from '@prisma/client'
import type { JobEvaluation, SearchJobResult } from './types'
import { analyzeJd, type JdFacts } from './jd-excerpt'

export type SeniorityClampMeta = {
  applied: boolean
  beforeScore: number
  afterScore: number
  direction: 'underqualified' | 'overqualified'
  reasons: string[]
  userLevel: string
  detected: {
    maxYearsRequired: number
    hasSeniorityTitleHint: boolean
    hasJuniorTitleHint: boolean
  }
}

const UNDERQUALIFIED_CAP = 38
const OVERQUALIFIED_CAP = 30

type NormalizedLevel =
  | 'internship'
  | 'entry_level'
  | 'mid_level'
  | 'senior_level'
  | 'director'
  | 'any'

function normalizeLevel(raw: string | null | undefined): NormalizedLevel {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v || v === 'any') return 'any'
  if (v.startsWith('intern')) return 'internship'
  if (v.startsWith('entry')) return 'entry_level'
  if (v.startsWith('mid')) return 'mid_level'
  if (v.startsWith('senior') || v === 'sr' || v === 'sr.') return 'senior_level'
  if (v.startsWith('director') || v.startsWith('head') || v.startsWith('principal'))
    return 'director'
  return 'any'
}

/** Upper bound of years of experience we consider acceptable for each user level. */
function yearsCeilingForLevel(level: NormalizedLevel): number {
  switch (level) {
    case 'internship':
      return 1
    case 'entry_level':
      return 3
    case 'mid_level':
      return 6
    case 'senior_level':
      return 15
    case 'director':
      return 20
    case 'any':
    default:
      return 100
  }
}

/** Lower bound of years we consider acceptable (to avoid senior user applying to intern). */
function yearsFloorForLevel(level: NormalizedLevel): number {
  switch (level) {
    case 'senior_level':
      return 4
    case 'director':
      return 6
    case 'internship':
    case 'entry_level':
    case 'mid_level':
    case 'any':
    default:
      return 0
  }
}

function titleSuggestsSenior(title: string): boolean {
  // Includes "senior" / "sr." so that "Senior Engineer" is caught for mid-level users
  return /\b(?:senior|sr\.?|staff|principal|lead|architect|director|head\s+of|chief)\b/i.test(title)
}

function titleSuggestsJunior(title: string): boolean {
  return /\b(?:intern(?:ship)?|fresher|junior|jr\.?|entry[-\s]?level|graduate|trainee)\b/i.test(
    title
  )
}

function buildUnderqualifiedReasons(
  title: string,
  facts: JdFacts,
  ceilingYears: number
): string[] {
  const reasons: string[] = []
  if (facts.maxYearsRequired > ceilingYears) {
    reasons.push(
      `JD requires ${facts.maxYearsRequired}+ years of experience; your level targets ≤ ${ceilingYears} years`
    )
  }
  if (titleSuggestsSenior(title)) {
    reasons.push(`JD title "${title}" indicates a senior/staff-level role`)
  }
  if (facts.hasSeniorityTitleHint && !titleSuggestsJunior(title)) {
    const lowered = title.toLowerCase()
    if (!/\b(senior|sr\.?|staff|principal|lead)\b/.test(lowered)) {
      reasons.push('JD body mentions senior-level expectations')
    }
  }
  return reasons
}

function buildOverqualifiedReasons(title: string, facts: JdFacts, floorYears: number): string[] {
  const reasons: string[] = []
  if (titleSuggestsJunior(title)) {
    reasons.push(`JD title "${title}" indicates an entry-level role`)
  }
  if (
    floorYears > 0 &&
    facts.maxYearsRequired > 0 &&
    facts.maxYearsRequired < floorYears &&
    facts.hasJuniorTitleHint
  ) {
    reasons.push(
      `JD requires only ${facts.maxYearsRequired} years; your level expects ≥ ${floorYears}`
    )
  }
  return reasons
}

export function applySeniorityClamp(
  job: SearchJobResult,
  config: BotConfig,
  evaluation: JobEvaluation,
  minScore: number
): { evaluation: JobEvaluation; clampMeta?: SeniorityClampMeta } {
  const level = normalizeLevel(config.experienceLevel)
  if (level === 'any') return { evaluation }

  const facts = analyzeJd(job.description ?? '')
  const ceiling = yearsCeilingForLevel(level)
  const floor = yearsFloorForLevel(level)

  const underReasons = buildUnderqualifiedReasons(job.title, facts, ceiling)
  const overReasons = buildOverqualifiedReasons(job.title, facts, floor)

  let cap = 100
  let direction: SeniorityClampMeta['direction'] | null = null
  let reasons: string[] = []

  if (underReasons.length > 0) {
    cap = Math.min(cap, UNDERQUALIFIED_CAP)
    direction = 'underqualified'
    reasons = underReasons
  }
  if (overReasons.length > 0 && (!direction || OVERQUALIFIED_CAP < cap)) {
    cap = Math.min(cap, OVERQUALIFIED_CAP)
    direction = 'overqualified'
    reasons = overReasons
  }

  if (!direction || cap >= evaluation.score) {
    return { evaluation }
  }

  const beforeScore = evaluation.score
  const afterScore = Math.min(beforeScore, cap)
  const flag = direction === 'underqualified' ? 'underqualified' : 'overqualified'
  const flags = Array.from(new Set([...evaluation.flags, flag]))

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
      direction,
      reasons,
      userLevel: level,
      detected: {
        maxYearsRequired: facts.maxYearsRequired,
        hasSeniorityTitleHint: facts.hasSeniorityTitleHint,
        hasJuniorTitleHint: facts.hasJuniorTitleHint,
      },
    },
  }
}
