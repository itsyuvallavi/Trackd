/**
 * Deterministic guardrail for seniority mismatch between the user's preferred
 * experience level (BotConfig.experienceLevel) and the JD's evident seniority.
 *
 *   mid / entry / internship vs "Staff / Principal / 10+ yrs"   → soft penalty, underqualified
 *   senior / director          vs "Intern / Fresher / Junior"   → soft penalty, overqualified
 *
 * Purely regex-based. The evaluator has the same info but may still over-score.
 * Seniority is a user preference, so this is intentionally not a hard reject.
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

const SENIOR_TITLE_PENALTY = 5
const VERY_SENIOR_TITLE_PENALTY = 14
const JUNIOR_TITLE_PENALTY = 6
const YEARS_GAP_PENALTY = 4
const VERY_SENIOR_CAP = 68

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

function titleSuggestsVerySenior(title: string): boolean {
  return /\b(?:staff|principal|architect|director|head\s+of|chief|vp|vice\s+president)\b/i.test(title)
}

function titleSuggestsJunior(title: string): boolean {
  return /\b(?:intern(?:ship)?|fresher|junior|jr\.?|entry[-\s]?level|graduate|trainee)\b/i.test(
    title
  )
}

function buildUnderqualifiedReasons(
  title: string,
  facts: JdFacts,
  ceilingYears: number,
  level: NormalizedLevel
): string[] {
  const reasons: string[] = []
  if (facts.maxYearsRequired > ceilingYears) {
    reasons.push(
      `JD requires ${facts.maxYearsRequired}+ years of experience; your level targets ≤ ${ceilingYears} years`
    )
  }

  const seniorTitleIsStretch =
    level === 'internship' || level === 'entry_level' || level === 'mid_level'
      ? titleSuggestsSenior(title)
      : level === 'senior_level'
        ? titleSuggestsVerySenior(title)
        : false

  if (seniorTitleIsStretch) {
    reasons.push(`JD title "${title}" suggests a more senior role`)
  }
  return reasons
}

function buildOverqualifiedReasons(title: string, facts: JdFacts, floorYears: number): string[] {
  const reasons: string[] = []
  if (floorYears > 0 && titleSuggestsJunior(title)) {
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

function normalizeSeniorityFlags(
  flags: string[],
  direction: SeniorityClampMeta['direction'] | null
): string[] {
  const cleaned = flags.filter((flag) => {
    if (flag === 'overqualified') return direction === 'overqualified'
    if (flag === 'underqualified') return direction === 'underqualified'
    return true
  })

  if (direction) cleaned.push(direction)
  return Array.from(new Set(cleaned))
}

export function applySeniorityClamp(
  job: SearchJobResult,
  config: BotConfig,
  evaluation: JobEvaluation,
  minScore: number
): { evaluation: JobEvaluation; clampMeta?: SeniorityClampMeta } {
  const level = normalizeLevel(config.experienceLevel)
  if (level === 'any') {
    return {
      evaluation: {
        ...evaluation,
        flags: normalizeSeniorityFlags(evaluation.flags, null),
      },
    }
  }

  const facts = analyzeJd(job.description ?? '')
  const ceiling = yearsCeilingForLevel(level)
  const floor = yearsFloorForLevel(level)

  const underReasons = buildUnderqualifiedReasons(job.title, facts, ceiling, level)
  const overReasons = buildOverqualifiedReasons(job.title, facts, floor)

  let direction: SeniorityClampMeta['direction'] | null = null
  let reasons: string[] = []

  if (underReasons.length > 0) {
    direction = 'underqualified'
    reasons = underReasons
  }
  if (overReasons.length > 0 && !direction) {
    direction = 'overqualified'
    reasons = overReasons
  }

  if (!direction) {
    return {
      evaluation: {
        ...evaluation,
        flags: normalizeSeniorityFlags(evaluation.flags, null),
      },
    }
  }

  const beforeScore = evaluation.score
  let afterScore = beforeScore

  if (direction === 'underqualified') {
    const yearsGap = Math.max(0, facts.maxYearsRequired - ceiling)
    const verySenior = titleSuggestsVerySenior(job.title)
    if (titleSuggestsSenior(job.title)) {
      afterScore -= verySenior ? VERY_SENIOR_TITLE_PENALTY : SENIOR_TITLE_PENALTY
    }
    if (yearsGap > 0) {
      afterScore -= Math.min(18, yearsGap * YEARS_GAP_PENALTY)
    }
    if (verySenior) {
      afterScore = Math.min(afterScore, VERY_SENIOR_CAP)
    }
  } else {
    afterScore -= JUNIOR_TITLE_PENALTY
  }

  afterScore = Math.max(0, Math.min(beforeScore, Math.round(afterScore)))

  const flags = normalizeSeniorityFlags(evaluation.flags, direction)

  if (afterScore >= beforeScore) {
    return {
      evaluation: {
        ...evaluation,
        flags,
      },
    }
  }

  const note = ` [Seniority preference adjustment: ${reasons.join('; ')}.]`
  const reasoning =
    evaluation.reasoning && !evaluation.reasoning.includes('Seniority preference adjustment')
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
