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
  userAcceptsUnitedStates,
  countryTokensFromJobLocationLine,
  hasRemoteWorkSignal,
  userWantsRemoteFirstUnlessListedCities,
  jdOnsiteBlobIncludesUserCity,
} from './user-locations'
import { analyzeJd } from './jd-excerpt'

export type PreFilterResult =
  | { rejected: false }
  | {
      rejected: true
      score: number
      flag: 'wrong_location' | 'underqualified' | 'overqualified' | 'career_change'
      reason: string
    }

// ── Location pre-filter ───────────────────────────────────────────────────

/** Job boards that only post US-based jobs. */
const US_ONLY_BOARDS = new Set(['dice', 'ziprecruiter', 'zip_recruiter'])

function cleanCapturedLocation(value: string): string | null {
  const cleaned = value
    .replace(/\b(?:remote|hybrid|onsite|on-site|in-office|fully|role|position|job)\b/gi, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .split(/\b(?:with|and|or|relocation|provided|required|available|only)\b|[,;|/]/i)[0]
    .replace(/[-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 2) return null
  if (/^(?:based|located|from|in|the|office|home|team|company|role)$/i.test(cleaned)) return null
  return cleaned.slice(0, 80)
}

function requiredBaseLocationSignals(job: SearchJobResult): string[] {
  const text = job.title.trim()
  if (!text.trim()) return []

  const signals = new Set<string>()
  const patterns = [
    /(?:^|[,(])\s*([a-z][a-z\s.'-]{2,50})\s*[-–—]\s*based\b/gi,
    /\b([a-z][a-z.'-]{2,30})[-\s]+based\b/gi,
    /\bbased\s+(?:in|out\s+of|from)\s+([a-z][a-z\s.'-]{2,80})/gi,
    /\bposition\s+(?:is\s+)?(?:based|located)\s+(?:in|out\s+of|from)\s+([a-z][a-z\s.'-]{2,80})/gi,
    /\brelocation\s+(?:provided|available|required|mandatory)\s+(?:to|in|for)\s+([a-z][a-z\s.'-]{2,80})/gi,
  ]

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      const cleaned = cleanCapturedLocation(match[1] ?? '')
      if (cleaned) signals.add(cleaned.toLowerCase())
      if (signals.size >= 5) break
    }
  }

  return [...signals]
}

function checkLocation(job: SearchJobResult, config: BotConfig): PreFilterResult {
  const user = parseUserLocations(config.locations)
  if (user.isAny) return { rejected: false }

  const baseLocationSignals = requiredBaseLocationSignals(job)
  if (
    baseLocationSignals.length > 0 &&
    !jdLocationOverlapsUser(baseLocationSignals, user)
  ) {
    return {
      rejected: true,
      score: 20,
      flag: 'wrong_location',
      reason:
        `Job text requires or implies a base location not in your Target locations ` +
        `(${baseLocationSignals.slice(0, 3).join(', ')}; yours: ${config.locations.join(', ')}).`,
    }
  }

  const loc = (job.location ?? '').trim()

  // No location metadata → can't pre-filter; let the LLM / geo clamp handle it.
  if (!loc || /^(n\/a|not specified|unknown)$/i.test(loc)) return { rejected: false }

  /**
   * A user who enters only "Remote" / "Anywhere" is asking for global remote
   * roles. Many boards still attach an employer HQ or payroll country to remote
   * rows, so accept rows that carry explicit remote evidence before country
   * filtering those metadata fields.
   */
  const onlyRemoteGlobal =
    user.hasRemoteToken && user.countries.size === 0 && user.cities.size === 0
  const listingRemote =
    job.is_remote === true || hasRemoteWorkSignal(loc) || hasRemoteWorkSignal(job.title)
  if (onlyRemoteGlobal && listingRemote) {
    return { rejected: false }
  }

  const countryTokens = countryTokensFromJobLocationLine(loc)

  if (countryTokens.length > 0) {
    if (jdLocationOverlapsUser(countryTokens, user)) return { rejected: false }

    const board = (job.jobBoard ?? job.source ?? '').toLowerCase()
    if (US_ONLY_BOARDS.has(board) && !userAcceptsUnitedStates(user)) {
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

  const board = (job.jobBoard ?? job.source ?? '').toLowerCase()
  if (US_ONLY_BOARDS.has(board) && !userAcceptsUnitedStates(user)) {
    return {
      rejected: true,
      score: 20,
      flag: 'wrong_location',
      reason: `Sourced from ${board} (US-only job board) and the United States is not in your Target locations.`,
    }
  }

  return { rejected: false }
}

/**
 * Remote-first Europe/EU seekers: accept employers anywhere in scope only when the
 * role is remote-friendly (or open to international), unless the JD ties on-site
 * work to a city the user explicitly listed (e.g. Lisbon, Porto).
 */
function checkRemoteWorkPolicy(job: SearchJobResult, config: BotConfig): PreFilterResult {
  const user = parseUserLocations(config.locations)
  if (user.isAny) return { rejected: false }
  if (!userWantsRemoteFirstUnlessListedCities(user, config.remoteOnly)) {
    return { rejected: false }
  }

  const loc = (job.location ?? '').trim()
  const listingRemote =
    job.is_remote === true || hasRemoteWorkSignal(loc) || hasRemoteWorkSignal(job.title)

  const facts = analyzeJd(job.description ?? '')
  const jdRemote =
    facts.mentionsRemoteFriendly ||
    facts.mentionsOpenToInternational

  if (listingRemote || jdRemote) {
    return { rejected: false }
  }

  const onsiteSignals =
    facts.requiresOnSiteOrHybrid || facts.onsiteCityPhrases.length > 0

  if (onsiteSignals) {
    if (jdOnsiteBlobIncludesUserCity(facts.onsiteCityPhrases, facts.requiredLocations, user)) {
      return { rejected: false }
    }
    return {
      rejected: true,
      score: 20,
      flag: 'wrong_location',
      reason:
        'This role looks on-site or hybrid in a location you did not list for in-person work. You want remote anywhere in Europe unless the employer is in a city you added to Target locations (e.g. Lisbon, Porto).',
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
 * and cheapest check. Seniority is intentionally not a hard pre-filter because
 * users treat the experience-level setting as guidance, not an absolute block.
 */
export function preFilterJob(job: SearchJobResult, config: BotConfig): PreFilterResult {
  const locResult = checkLocation(job, config)
  if (locResult.rejected) return locResult

  const remotePolicy = checkRemoteWorkPolicy(job, config)
  if (remotePolicy.rejected) return remotePolicy

  return { rejected: false }
}
