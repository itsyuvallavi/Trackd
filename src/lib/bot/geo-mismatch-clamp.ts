/**
 * Deterministic geo guardrail driven by the user's BotConfig.locations list.
 *
 * No hardcoded "country X is bad". Logic:
 *   1. Parse the user's "Target locations" into countries / cities / remote tokens.
 *   2. Extract JD-mandated locations (countries / cities / onsite phrases) from the full JD.
 *   3. If the JD mandates a location the user did NOT list:
 *        - remoteOnly=true and JD is not remote-friendly → hard cap
 *        - remoteOnly=false → hard cap
 *   4. Citizenship / clearance / W-2 only penalise when the user's locations do NOT
 *      include the corresponding country. (E.g. "US citizen" is only a blocker when
 *      the user did not list the United States as an acceptable location.)
 *   5. job.is_remote === false when user has `remoteOnly=true` → soft cap.
 */

import type { BotConfig } from '@prisma/client'
import type { JobEvaluation, SearchJobResult } from './types'
import { analyzeJd, type JdFacts } from './jd-excerpt'
import {
  parseUserLocations,
  userAcceptsUnitedStates,
  jdLocationOverlapsUser,
  countryTokensFromJobLocationLine,
  type UserLocationTokens,
} from './user-locations'

export type GeoMismatchClampMeta = {
  applied: boolean
  beforeScore: number
  afterScore: number
  reasons: string[]
  signals: {
    jdRequiredLocations: string[]
    onsiteCityPhrases: string[]
    requiresOnSiteOrHybrid: boolean
    requiresClearance: boolean
    requiredCitizenships: string[]
    w2Only: boolean
    noSponsorship: boolean
    jobIsRemoteFalse: boolean
    impliesUsOnly: boolean
    usOnlySignals: string[]
    mentionsOpenToInternational: boolean
    userLocations: string[]
    userRemoteOnly: boolean
  }
}

/** Cap when the JD has a hard incompatible-location signal for this user. */
const HARD_GEO_CAP = 30
/** Softer cap when the source row says `is_remote === false` but text is unclear. */
const SOFT_GEO_CAP = 42

/**
 * Citizenship / clearance phrases usually tie to a specific country. When the
 * user has NOT listed that country as an acceptable location, we treat it as
 * a hard mismatch. When the user HAS listed it, we stay out of the way.
 */
const CITIZENSHIP_COUNTRY_ALIASES: Record<string, string> = {
  'u.s.': 'united states',
  'u.s': 'united states',
  us: 'united states',
  usa: 'united states',
  american: 'united states',
  canadian: 'canada',
  canada: 'canada',
  british: 'united kingdom',
  uk: 'united kingdom',
  'u.k.': 'united kingdom',
  irish: 'ireland',
  ireland: 'ireland',
  german: 'germany',
  germany: 'germany',
  french: 'france',
  france: 'france',
  italian: 'italy',
  italy: 'italy',
  spanish: 'spain',
  spain: 'spain',
  portuguese: 'portugal',
  portugal: 'portugal',
  dutch: 'netherlands',
  netherlands: 'netherlands',
  brazilian: 'brazil',
  brazil: 'brazil',
  indian: 'india',
  india: 'india',
  israeli: 'israel',
  israel: 'israel',
  australian: 'australia',
  australia: 'australia',
  japanese: 'japan',
  japan: 'japan',
}

function citizenshipCountry(token: string): string | null {
  const t = token.toLowerCase().trim()
  return CITIZENSHIP_COUNTRY_ALIASES[t] ?? null
}

function buildReasons(
  facts: JdFacts,
  user: UserLocationTokens,
  userWantsRemote: boolean,
  listingLocationLine: string | null | undefined
): string[] {
  const reasons: string[] = []

  if (user.isAny) return reasons

  const listingToks = countryTokensFromJobLocationLine(listingLocationLine ?? '')
  if (
    listingToks.length > 0 &&
    !jdLocationOverlapsUser(listingToks, user)
  ) {
    reasons.push(
      `Job listing location "${(listingLocationLine ?? '').trim() || '—'}" is not in your Target locations (${user.raw.join(', ') || 'none'})`
    )
  }

  // 1. JD-mandated country/region not in user's list.
  // Escape hatch: if the user accepts remote (either via `remoteOnly=true` or
  // because "Remote" is one of their Target locations) AND the JD is fully
  // remote, the mandated location doesn't matter.
  if (facts.requiredLocations.length > 0) {
    const overlaps = jdLocationOverlapsUser(facts.requiredLocations, user)
    const userAcceptsRemote = userWantsRemote || user.hasRemoteToken
    const jdOffersRemoteElsewhere = userAcceptsRemote && facts.mentionsRemoteFriendly
    if (!overlaps && !jdOffersRemoteElsewhere) {
      reasons.push(
        `JD mandates location not in your Target locations (${facts.requiredLocations.slice(0, 3).join(', ')}; yours: ${user.raw.join(', ') || 'none'})`
      )
    }
  }

  // 2. Specific-city onsite/hybrid requirement not covered by user's cities.
  if (facts.onsiteCityPhrases.length > 0) {
    const jdText = facts.onsiteCityPhrases.join(' ').toLowerCase()
    let cityMatched = false
    for (const city of user.cities) {
      if (city.length >= 2 && jdText.includes(city)) {
        cityMatched = true
        break
      }
    }
    if (!cityMatched) {
      reasons.push('JD requires on-site/hybrid in a city not in your Target locations')
    }
  }

  // 3. Generic on-site only + user wants remote.
  if (userWantsRemote && facts.requiresOnSiteOrHybrid && !facts.mentionsRemoteFriendly) {
    reasons.push('JD requires on-site or hybrid; you prefer remote only')
  }

  // 4. Relocation required.
  if (userWantsRemote && facts.mentionsRelocation) {
    reasons.push('JD requires relocation; you prefer remote only')
  }

  // 5. Country-specific eligibility (citizenship / clearance / W-2 only).
  //    Only penalise when the user has NOT listed that country.
  if (facts.requiredCitizenships.length > 0) {
    const blockedBy = facts.requiredCitizenships
      .map((tok) => citizenshipCountry(tok))
      .filter((c): c is string => !!c)
      .filter((c) => !user.countries.has(c))
    if (blockedBy.length > 0) {
      reasons.push(
        `JD requires citizenship of ${[...new Set(blockedBy)].join(', ')} (not in your Target locations)`
      )
    }
  }

  if (facts.requiresClearance && !userAcceptsUnitedStates(user)) {
    reasons.push('JD requires US security clearance; you did not list the United States')
  }

  if (facts.w2Only && !userAcceptsUnitedStates(user)) {
    reasons.push('JD is W-2 only (US employment); you did not list the United States')
  }

  // 6. Implicit US-only employment (401k / W-2 / EEO / FLSA / medical-dental-vision /
  //    "authorized to work in the US" / state pay transparency / US time zones).
  //    A job saying "Remote" at the top while the body has 2+ of these signals is
  //    almost always "Remote, US only" — clamp it for non-US users UNLESS the JD
  //    explicitly says it hires internationally.
  if (
    facts.impliesUsOnly &&
    !userAcceptsUnitedStates(user) &&
    !facts.mentionsOpenToInternational
  ) {
    const signalLabel = facts.usOnlySignals.slice(0, 4).join(', ')
    reasons.push(
      `JD reads as US-only (signals: ${signalLabel}) and you did not list the United States; "Remote" alone doesn't override these`
    )
  }

  if (facts.noSponsorship && !facts.sponsorshipAvailable && !user.isAny) {
    // Sponsorship is only strictly bad when the user would need it — we can't
    // know that here, so we flag only when there's also an unacceptable required
    // location. Handled indirectly via reason 1. Keep explicit signal in meta.
  }

  return reasons
}

export function applyGeoMismatchClamp(
  job: SearchJobResult,
  config: BotConfig,
  evaluation: JobEvaluation,
  minScore: number
): { evaluation: JobEvaluation; clampMeta?: GeoMismatchClampMeta } {
  const user = parseUserLocations(config.locations)
  const userWantsRemote = config.remoteOnly === true

  const facts = analyzeJd(job.description ?? '')
  const hardReasons = buildReasons(facts, user, userWantsRemote, job.location)

  let cap = 100
  const reasons: string[] = [...hardReasons]
  if (hardReasons.length > 0) cap = Math.min(cap, HARD_GEO_CAP)

  // Soft signal: API row marks the job non-remote and user wants remote.
  if (
    userWantsRemote &&
    job.is_remote === false &&
    !facts.mentionsRemoteFriendly &&
    cap > SOFT_GEO_CAP
  ) {
    cap = SOFT_GEO_CAP
    reasons.push('listing marked is_remote=false and JD does not offer remote')
  }

  if (reasons.length === 0 || cap >= evaluation.score) {
    return { evaluation }
  }

  const beforeScore = evaluation.score
  const afterScore = Math.min(beforeScore, cap)
  const flags = Array.from(new Set([...evaluation.flags, 'wrong_location']))

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
      signals: {
        jdRequiredLocations: facts.requiredLocations,
        onsiteCityPhrases: facts.onsiteCityPhrases,
        requiresOnSiteOrHybrid: facts.requiresOnSiteOrHybrid,
        requiresClearance: facts.requiresClearance,
        requiredCitizenships: facts.requiredCitizenships,
        w2Only: facts.w2Only,
        noSponsorship: facts.noSponsorship && !facts.sponsorshipAvailable,
        jobIsRemoteFalse: job.is_remote === false,
        impliesUsOnly: facts.impliesUsOnly,
        usOnlySignals: facts.usOnlySignals,
        mentionsOpenToInternational: facts.mentionsOpenToInternational,
        userLocations: user.raw,
        userRemoteOnly: userWantsRemote,
      },
    },
  }
}
