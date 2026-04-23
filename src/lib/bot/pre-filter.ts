/**
 * Deterministic pre-filter — fast, 100% reliable yes/no decisions that run
 * BEFORE the LLM is called.
 *
 * The LLM is probabilistic: it may ignore instructions ~5% of the time.
 * That is not acceptable for hard rules like "this job is in India, reject it"
 * or "the title says Senior, reject it for a mid-level user."
 *
 * These checks are pure code with zero randomness. A job that fails pre-filter
 * is immediately rejected with score 20 — no LLM call is made, saving cost and
 * guaranteeing correctness.
 *
 * What the LLM evaluates AFTER this gate:
 *   "Do the skills/experience in this job description match the user's resume?"
 * That is the only question the LLM is good at.
 */

import type { BotConfig } from '@prisma/client'
import type { SearchJobResult } from './types'
import {
  parseUserLocations,
  jdLocationOverlapsUser,
} from './user-locations'

export type PreFilterResult =
  | { rejected: false }
  | {
      rejected: true
      score: number
      flag: 'wrong_location' | 'underqualified' | 'overqualified'
      reason: string
    }

// ── Helpers ───────────────────────────────────────────────────────────────

// US state abbreviations — when the last location segment is one of these,
// the job is implicitly in the United States.
const US_STATE_CODES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
])

/**
 * Extracts the most-likely country token(s) from a formatted location string.
 *
 * Handles:
 *   "Bengaluru, Karnataka, India"       → ["india"]
 *   "Chicago, IL"                       → ["united states"]  (state code)
 *   "London, England, UK"               → ["united kingdom"]
 *   "Amstelveen, North Holland, Netherlands" → ["netherlands"]
 *   "Remote"                            → []  (skip filter)
 */
function extractCountryTokens(location: string): string[] {
  const loc = location.trim()
  if (!loc) return []

  // "Remote" alone or with a region → don't filter on country
  if (/^remote$/i.test(loc)) return []
  if (/\bremote\b/i.test(loc)) return []

  // Placeholders
  if (/^(n\/a|not specified|unknown)$/i.test(loc)) return []

  const parts = loc
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (parts.length === 0) return []

  const last = parts[parts.length - 1]

  const normalise = (t: string): string => {
    if (/^(uk|great britain|england|scotland|wales|northern ireland)$/.test(t))
      return 'united kingdom'
    if (/^(usa|u\.s\.a?\.?|united states of america)$/.test(t))
      return 'united states'
    return t
  }

  const candidates = new Set<string>()

  // If last segment is a US state code (e.g. "IL", "NY") → United States
  if (US_STATE_CODES.has(last)) {
    candidates.add('united states')
    // Also check second-to-last in case format is "City, ST, USA"
    if (parts.length >= 3) {
      const thirdLast = parts[parts.length - 3]
      candidates.add(thirdLast)
      candidates.add(normalise(thirdLast))
    }
  } else {
    candidates.add(last)
    candidates.add(normalise(last))
    // For 3-part "City, Region, Country" also try the region as a city fallback
    if (parts.length >= 2) {
      candidates.add(parts[0])
    }
  }

  return [...candidates].filter(Boolean)
}

// ── Location pre-filter ───────────────────────────────────────────────────

/** Job boards that only post US-based jobs. */
const US_ONLY_BOARDS = new Set(['dice', 'ziprecruiter', 'zip_recruiter'])

function checkLocation(job: SearchJobResult, config: BotConfig): PreFilterResult {
  const user = parseUserLocations(config.locations)
  if (user.isAny) return { rejected: false }

  // The API row explicitly marks the job as remote → location of HQ is irrelevant.
  if (job.is_remote === true) return { rejected: false }

  const loc = (job.location ?? '').trim()

  // No location metadata → can't pre-filter; let the LLM handle it.
  if (!loc || /^(n\/a|not specified|unknown)$/i.test(loc)) return { rejected: false }

  // Contains "Remote" anywhere → don't pre-filter (e.g. "Remote, United States").
  if (/\bremote\b/i.test(loc)) return { rejected: false }

  const countryTokens = extractCountryTokens(loc)
  if (countryTokens.length === 0) return { rejected: false }

  // Check all extracted tokens against the user's accepted locations (with EU/Europe expansion).
  if (jdLocationOverlapsUser(countryTokens, user)) return { rejected: false }

  // Known US-only board — add a clearer reason.
  const board = (job.jobBoard ?? job.source ?? '').toLowerCase()
  if (US_ONLY_BOARDS.has(board) && !user.countries.has('united states')) {
    return {
      rejected: true,
      score: 20,
      flag: 'wrong_location',
      reason: `Sourced from ${board} (US-only job board) and the United States is not in your Target locations.`,
    }
  }

  const countryLabel = countryTokens[0]
  return {
    rejected: true,
    score: 20,
    flag: 'wrong_location',
    reason: `Job location "${loc}" (${countryLabel}) is not in your Target locations (${config.locations.join(', ')}).`,
  }
}

// ── Seniority pre-filter ──────────────────────────────────────────────────

type SeniorityLevel =
  | 'internship'
  | 'entry_level'
  | 'mid_level'
  | 'senior_level'
  | 'director'
  | 'any'

function normaliseLevel(raw: string | null | undefined): SeniorityLevel {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v || v === 'any') return 'any'
  if (v.startsWith('intern')) return 'internship'
  if (v.startsWith('entry')) return 'entry_level'
  if (v.startsWith('mid')) return 'mid_level'
  if (v.startsWith('senior') || v === 'sr' || v === 'sr.') return 'senior_level'
  if (
    v.startsWith('director') ||
    v.startsWith('head') ||
    v.startsWith('principal') ||
    v.startsWith('vp')
  )
    return 'director'
  return 'any'
}

// Titles that are clearly senior/staff-level regardless of the word "senior"
const SENIOR_TITLE_RE =
  /\b(?:senior|sr\.?|staff|principal|lead|architect|director|head\s+of|chief|vp|vice\s+president)\b/i
// Titles that are clearly entry-level / internship
const JUNIOR_TITLE_RE =
  /\b(?:intern(?:ship)?|fresher|junior|jr\.?|entry[-\s]?level|graduate\s+developer|graduate\s+engineer|trainee|associate\s+(?:developer|engineer|software))\b/i

function checkSeniority(job: SearchJobResult, config: BotConfig): PreFilterResult {
  const level = normaliseLevel(config.experienceLevel)
  if (level === 'any') return { rejected: false }

  const title = job.title ?? ''

  // Mid / entry / intern user applying to a Senior/Staff/Lead/Principal title → underqualified
  if (
    (level === 'mid_level' || level === 'entry_level' || level === 'internship') &&
    SENIOR_TITLE_RE.test(title)
  ) {
    return {
      rejected: true,
      score: 20,
      flag: 'underqualified',
      reason: `Job title "${title}" is a senior-level role; your experience level is ${level}.`,
    }
  }

  // Senior / Director user applying to a Junior/Intern title → overqualified
  if (
    (level === 'senior_level' || level === 'director') &&
    JUNIOR_TITLE_RE.test(title)
  ) {
    return {
      rejected: true,
      score: 20,
      flag: 'overqualified',
      reason: `Job title "${title}" is an entry-level role; your experience level is ${level}.`,
    }
  }

  return { rejected: false }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Run all deterministic pre-filters on a job BEFORE calling the LLM.
 *
 * Returns the first rejection that applies, or `{ rejected: false }` when all
 * checks pass and the LLM evaluation should proceed.
 *
 * Order matters: location is checked first because it is the most definitive
 * and cheapest check.
 */
export function preFilterJob(job: SearchJobResult, config: BotConfig): PreFilterResult {
  const locResult = checkLocation(job, config)
  if (locResult.rejected) return locResult

  const seniorityResult = checkSeniority(job, config)
  if (seniorityResult.rejected) return seniorityResult

  return { rejected: false }
}
