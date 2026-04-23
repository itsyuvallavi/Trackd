/**
 * Smart JD excerpt for the evaluator.
 *
 * Long job descriptions often hide deal-breaker facts (on-site city, required
 * citizenship, mandatory seniority, required spoken language) *after* the first
 * 3 000 chars. The evaluator only sees what we pass. This module returns:
 *   - a compact structured facts block (for the model, easy to scan)
 *   - a smart excerpt that concatenates: the opening of the JD + sentences matching
 *     critical signal regexes from anywhere in the JD
 *
 * Purely regex-based, fully user-settings-driven (no hardcoded "US is bad"). The
 * geo-mismatch-clamp compares detected JD locations against the user's
 * `BotConfig.locations` list to decide whether the JD is acceptable.
 */

const HEAD_CHARS = 1400
/** Hard ceiling for the excerpt sent to the model. */
const EXCERPT_MAX_CHARS = 3200
/** How much of the JD we scan for facts, regardless of head-excerpt length. */
const SCAN_MAX_CHARS = 18000

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+|\n+/

// ── Location / work-style patterns ──────────────────────────────────────
/**
 * Captures the "place" in "must be based in X" / "located in X" / "eligible to
 * work in X" phrases — used so we can check whether X overlaps with the user's
 * Target locations list.
 */
const REQUIRED_LOCATION_CAPTURE_RE =
  /\b(?:must\s+(?:be|reside|live|work)\s+(?:in|within|from)|(?:based|located)\s+in|require[ds]?\s+to\s+(?:be|live|work)\s+in|eligible\s+to\s+work\s+(?:in|from)|position\s+(?:is\s+)?(?:based\s+in|located\s+in))\s+(?:the\s+)?([a-z][a-z\s.,'-]{2,80})/gi

const CITY_ONSITE_RE =
  /\b(?:on[-\s]?site|in[-\s]?office|in[-\s]?person|hybrid)\b[^.\n]{0,80}\b(?:required|mandatory|\d+\s*days?\s*(?:per|a)\s*week|every\s+week)\b/i
const ONSITE_GENERIC_RE =
  /\b(?:must\s+(?:be|work)\s+on[-\s]?site|100%\s+on[-\s]?site|fully\s+on[-\s]?site|on[-\s]?site\s+only|relocation\s+required)\b/i
const REMOTE_FRIENDLY_RE =
  /\b(?:fully\s+remote|100%\s+remote|remote[-\s]?first|work\s+from\s+anywhere|open\s+to\s+remote|remote\s+(?:europe|eu|emea|eea|na|latam|apac|global|worldwide))\b/i
const RELOCATION_RE =
  /\b(?:relocation\s+(?:is\s+)?(?:required|mandatory)|must\s+relocate|no\s+relocation\s+assistance\s+provided|willingness\s+to\s+relocate)\b/i

// Eligibility / sponsorship signals (generic — apply only when the user didn't
// select the corresponding country / pick up on this via the clamp).
const CLEARANCE_RE =
  /\b(?:security\s+clearance|ts\/sci|top\s+secret|secret\s+clearance|active\s+clearance|nato\s+clearance)\b/i
const CITIZENSHIP_CAPTURE_RE =
  /\b(?:must\s+be\s+(?:a\s+)?|require[ds]?\s+to\s+be\s+(?:a\s+)?)?([a-z][a-z\s.'-]{2,40})\s+citizen(?:ship)?\b/gi
const W2_ONLY_RE = /\bW[-\s]?2\s+only\b/i
const NO_SPONSORSHIP_RE =
  /\b(?:no\s+sponsorship|do(?:es)?\s+not\s+(?:offer|provide)\s+sponsorship|without\s+sponsorship|not\s+(?:able|sponsoring)\b[^.\n]{0,60}\bvisa)\b/i
const SPONSORSHIP_AVAILABLE_RE =
  /\b(?:sponsorship\s+(?:available|provided|offered)|we\s+sponsor\s+visas?|visa\s+sponsorship\s+(?:is\s+)?available)\b/i

// ── Implicit "this is a US job" signals ──────────────────────────────────
// Job boards & recruiters rarely say "USA only" in the JD. But US employers
// have a distinctive vocabulary (401(k), W-2, EEO, medical/dental/vision,
// FLSA, "authorized to work in the United States", state pay disclosures).
// Each match counts as ONE signal; `impliesUsOnly` becomes true when the
// signal count crosses a threshold (see analyzeJd) so a single diversity
// boilerplate line does not trigger a false positive.
const US_SIGNAL_401K_RE = /\b401\s*\(?\s*k\s*\)?\b/i
const US_SIGNAL_W2_RE = /\b(?:W[-\s]?2\s+(?:employ(?:ee|ment)|position|only)|1099\s+contract)\b/i
const US_SIGNAL_EEO_RE =
  /\b(?:equal\s+(?:employment\s+)?opportunity|eoe|eeo(?:-?m\/f\/d\/v)?|affirmative\s+action\s+employer)\b/i
const US_SIGNAL_FLSA_RE = /\b(?:FLSA|non[-\s]?exempt|exempt\s+status)\b/i
const US_SIGNAL_ADA_RE =
  /\b(?:ADA\b(?:\s+accommodation)?|americans\s+with\s+disabilities\s+act)\b/i
const US_SIGNAL_MDV_RE =
  /\b(?:medical[,\s]+dental[,\s]+(?:and\s+)?vision|health[,\s]+dental[,\s]+(?:and\s+)?vision)\b/i
const US_SIGNAL_AUTH_RE =
  /\b(?:must\s+be\s+(?:legally\s+)?(?:authorized|eligible)\s+to\s+work\s+in\s+(?:the\s+)?(?:us|u\.s\.?|usa|united\s+states)|authorization\s+to\s+work\s+in\s+(?:the\s+)?(?:us|u\.s\.?|united\s+states))\b/i
const US_SIGNAL_STATE_PAY_RE =
  /\b(?:(?:for|pay\s+(?:range|transparency)[^.\n]{0,40}?)(?:california|colorado|new\s+york|nyc|washington|connecticut)\s+(?:residents|applicants|candidates|employees|pay))\b/i
const US_SIGNAL_US_TZ_RE =
  /\b(?:Eastern|Pacific|Central|Mountain)\s+(?:Time|Standard\s+Time|Daylight\s+Time)\b|\b(?:EST|EDT|PST|PDT|CST|CDT|MST|MDT)\b/i
const US_SIGNAL_USD_ONLY_RE =
  /\b(?:USD\s*\$?\s*\d|\$\d[\d,]*(?:\.\d+)?\s*(?:-|–|to)\s*\$?\d[\d,]*(?:\.\d+)?)\b/i

// Open-to-international / remote-without-borders signals (overrides US-only heuristics).
const OPEN_TO_INTERNATIONAL_RE =
  /\b(?:open\s+to\s+international|international\s+candidates\s+welcome|hire\s+(?:globally|worldwide|internationally)|work\s+from\s+anywhere\s+in\s+the\s+world|any\s+(?:country|timezone|time\s+zone)|we\s+are\s+(?:a\s+)?(?:fully\s+)?(?:remote|distributed|global)\s+(?:team|company)|remote\s+(?:worldwide|global|anywhere))\b/i

// Experience signals
const YEARS_RE =
  /\b(\d{1,2})\s*\+?\s*(?:to\s*\d{1,2}\s*)?years?\b[^.\n]{0,120}\b(?:experience|exp\.?)\b/i
const SENIORITY_TITLE_RE =
  /\b(?:staff|principal|lead|architect|director|head\s+of|chief|senior|sr\.?)\b/i
const JUNIOR_TITLE_RE = /\b(?:intern(?:ship)?|fresher|junior|jr\.?|entry[-\s]?level|graduate|trainee)\b/i

// Spoken-language signals
const LANG_REQ_RE =
  /\b(?:must\s+(?:speak|be\s+fluent)|fluent\s+in|mandatory\s+language|required\s+language|native\s+(?:speaker\s+)?(?:of|in)?|business\s+level|professional\s+proficiency|bilingual\s+in)\b[^.\n]{0,120}/i
const LANG_NAMES_RE =
  /\b(english|spanish|español|french|français|german|deutsch|italian|italiano|portuguese|português|dutch|nederlands|polish|russian|turkish|arabic|hebrew|hindi|chinese|mandarin|japanese|korean|swedish|danish|norwegian|finnish|czech|romanian|greek)\b/i

// ── Types ─────────────────────────────────────────────────────────────────
export type JdFacts = {
  /** Country / region names captured from explicit "must be based in X" phrases. */
  requiredLocations: string[]
  /** City-onsite/hybrid phrases (e.g. "2 days per week in London office"). */
  onsiteCityPhrases: string[]
  /** Generic on-site-only phrases without a specific city. */
  requiresOnSiteOrHybrid: boolean
  /** Any "fully remote"/"remote Europe" style wording found. */
  mentionsRemoteFriendly: boolean
  /** Any "must relocate" / "relocation required" wording. */
  mentionsRelocation: boolean
  /** Clearance phrases (TS/SCI, Secret, etc.) — generic. */
  requiresClearance: boolean
  /** Countries mentioned in "X citizen(ship)" constructions (lowercased). */
  requiredCitizenships: string[]
  w2Only: boolean
  noSponsorship: boolean
  sponsorshipAvailable: boolean
  /** First ≤5 "N+ years of experience" sentences. */
  yearsRequiredPhrases: string[]
  /** Max N from yearsRequiredPhrases. */
  maxYearsRequired: number
  hasSeniorityTitleHint: boolean
  hasJuniorTitleHint: boolean
  /** Sentences in a requirement context that name a spoken language (first ≤5). */
  mandatoryLanguageSnippets: string[]
  descriptionTooShort: boolean
  scannedChars: number
  /** JD ties the role to US soil (used by geo clamp). */
  requiresUsLocation: boolean
  /** JD calls out a specific city for on-site/hybrid. */
  requiresSpecificUsCity: boolean
  /** "U.S. citizen" style hard requirements. */
  requiresUsCitizen: boolean
  /**
   * True when ≥ 2 implicit US-employment signals were found (401k, W-2, EEO,
   * FLSA, ADA, medical/dental/vision, "authorized to work in the US", US time
   * zones, state pay-range disclosures, USD-only salary).
   *
   * Used by geo-mismatch-clamp to catch "Remote" US-only jobs that never
   * literally say "USA only" in the JD.
   */
  impliesUsOnly: boolean
  /** Which of the implicit US-employment signals fired (for audit). */
  usOnlySignals: string[]
  /** Explicit wording that the role is open to candidates anywhere / any country. */
  mentionsOpenToInternational: boolean
}

export type SmartJdExcerpt = {
  facts: JdFacts
  excerpt: string
  excerptChars: number
  extraSignalSentencesAppended: number
}

// ── Helpers ───────────────────────────────────────────────────────────────
function extractYearsRequired(scanned: string): { phrases: string[]; max: number } {
  const phrases: string[] = []
  let max = 0
  const sentences = scanned.split(SENTENCE_SPLIT_RE)
  for (const raw of sentences) {
    const s = raw.trim()
    if (!s) continue
    const m = s.match(YEARS_RE)
    if (!m) continue
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n)) max = Math.max(max, n)
    phrases.push(s.slice(0, 220))
    if (phrases.length >= 5) break
  }
  return { phrases, max }
}

function extractMandatoryLanguageSnippets(scanned: string): string[] {
  const out: string[] = []
  const sentences = scanned.split(SENTENCE_SPLIT_RE)
  for (const raw of sentences) {
    const s = raw.trim()
    if (!s) continue
    if (!LANG_REQ_RE.test(s)) continue
    if (!LANG_NAMES_RE.test(s)) continue
    out.push(s.slice(0, 260))
    if (out.length >= 5) break
  }
  return out
}

function extractRequiredLocations(scanned: string): string[] {
  const out: string[] = []
  const lower = scanned.toLowerCase()
  REQUIRED_LOCATION_CAPTURE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = REQUIRED_LOCATION_CAPTURE_RE.exec(lower))) {
    const captured = m[1]?.trim()
    if (!captured) continue
    const cleaned = captured
      .split(/[.,;]|\bor\b|\band\b/)[0]
      .trim()
      .replace(/['"]/g, '')
    if (!cleaned || cleaned.length < 2) continue
    if (!out.includes(cleaned) && cleaned.length <= 60) out.push(cleaned)
    if (out.length >= 8) break
  }
  return out
}

function extractOnsiteCityPhrases(scanned: string): string[] {
  const out: string[] = []
  const sentences = scanned.split(SENTENCE_SPLIT_RE)
  for (const raw of sentences) {
    const s = raw.trim()
    if (!s) continue
    if (!CITY_ONSITE_RE.test(s)) continue
    out.push(s.slice(0, 240))
    if (out.length >= 5) break
  }
  return out
}

function extractRequiredCitizenships(scanned: string): string[] {
  const out = new Set<string>()
  const lower = scanned.toLowerCase()
  CITIZENSHIP_CAPTURE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CITIZENSHIP_CAPTURE_RE.exec(lower))) {
    const captured = m[1]?.trim()
    if (!captured) continue
    const token = captured.replace(/\s+/g, ' ').trim()
    // Typical captures: "u.s.", "us", "eu", "canadian", "irish"
    if (token.length > 40) continue
    if (/^(?:a|the|any|local|valid|full)$/.test(token)) continue
    out.add(token)
    if (out.size >= 5) break
  }
  return [...out]
}

function collectSignalSentences(scanned: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  const push = (s: string) => {
    const key = s.trim().slice(0, 220)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(key)
  }

  const signalPatterns: RegExp[] = [
    /\b(?:must\s+(?:be|reside|live|work)\s+(?:in|within|from)|(?:based|located)\s+in|eligible\s+to\s+work\s+(?:in|from))\b/i,
    CITY_ONSITE_RE,
    ONSITE_GENERIC_RE,
    REMOTE_FRIENDLY_RE,
    RELOCATION_RE,
    CLEARANCE_RE,
    /\bcitizen(?:ship)?\b/i,
    W2_ONLY_RE,
    NO_SPONSORSHIP_RE,
    SPONSORSHIP_AVAILABLE_RE,
    YEARS_RE,
    LANG_REQ_RE,
    US_SIGNAL_AUTH_RE,
    US_SIGNAL_STATE_PAY_RE,
    US_SIGNAL_401K_RE,
    US_SIGNAL_MDV_RE,
    OPEN_TO_INTERNATIONAL_RE,
  ]

  const sentences = scanned.split(SENTENCE_SPLIT_RE)
  for (const raw of sentences) {
    const s = raw.trim()
    if (s.length < 12) continue
    if (signalPatterns.some((re) => re.test(s))) push(s)
    if (out.length >= 20) break
  }
  return out
}

// ── Public API ────────────────────────────────────────────────────────────

export function analyzeJd(rawDescription: string | null | undefined): JdFacts {
  const full = (rawDescription || '').slice(0, SCAN_MAX_CHARS)
  const scanned = full
  const lower = scanned.toLowerCase()

  const yrs = extractYearsRequired(scanned)
  const requiredLocations = extractRequiredLocations(scanned)
  const onsiteCityPhrases = extractOnsiteCityPhrases(scanned)
  const requiredCitizenships = extractRequiredCitizenships(scanned)

  const requiresUsLocation =
    requiredLocations.some((loc) =>
      /^(?:united states|usa|u\.s\.?)$/i.test(loc.trim()) ||
      /\b(?:united states|u\.s\.|usa)\b/i.test(loc)
    ) ||
    /\b(?:only|must|required)[^.\n]{0,120}\b(?:united states|u\.s\.|usa|us-based|us office)\b/i.test(
      lower
    )

  const requiresSpecificUsCity = onsiteCityPhrases.length > 0

  const requiresUsCitizen = requiredCitizenships.some((c) =>
    /^(?:us|u\.s\.|united states|american)\b/i.test(c.trim())
  )

  const usSignalChecks: Array<[string, RegExp]> = [
    ['401k_benefits', US_SIGNAL_401K_RE],
    ['w2_or_1099_employment', US_SIGNAL_W2_RE],
    ['eeo_boilerplate', US_SIGNAL_EEO_RE],
    ['flsa_exempt_nonexempt', US_SIGNAL_FLSA_RE],
    ['ada_accommodation', US_SIGNAL_ADA_RE],
    ['medical_dental_vision', US_SIGNAL_MDV_RE],
    ['must_be_authorized_to_work_in_us', US_SIGNAL_AUTH_RE],
    ['state_pay_transparency', US_SIGNAL_STATE_PAY_RE],
    ['us_time_zone_schedule', US_SIGNAL_US_TZ_RE],
    ['usd_only_salary_range', US_SIGNAL_USD_ONLY_RE],
  ]
  const usOnlySignals = usSignalChecks
    .filter(([, re]) => re.test(scanned))
    .map(([name]) => name)
  // Auth-to-work-in-US is on its own a hard mismatch for non-US users.
  // 2 or more of the softer signals together also imply US-only employment.
  const authToWorkInUs = usOnlySignals.includes('must_be_authorized_to_work_in_us')
  const impliesUsOnly = authToWorkInUs || usOnlySignals.length >= 2

  const mentionsOpenToInternational = OPEN_TO_INTERNATIONAL_RE.test(scanned)

  return {
    requiredLocations,
    onsiteCityPhrases,
    requiresOnSiteOrHybrid: ONSITE_GENERIC_RE.test(scanned) || CITY_ONSITE_RE.test(scanned),
    mentionsRemoteFriendly: REMOTE_FRIENDLY_RE.test(scanned),
    mentionsRelocation: RELOCATION_RE.test(scanned),
    requiresClearance: CLEARANCE_RE.test(scanned),
    requiredCitizenships,
    w2Only: W2_ONLY_RE.test(scanned),
    noSponsorship: NO_SPONSORSHIP_RE.test(scanned),
    sponsorshipAvailable: SPONSORSHIP_AVAILABLE_RE.test(scanned),
    yearsRequiredPhrases: yrs.phrases,
    maxYearsRequired: yrs.max,
    hasSeniorityTitleHint: SENIORITY_TITLE_RE.test(scanned),
    hasJuniorTitleHint: JUNIOR_TITLE_RE.test(scanned),
    mandatoryLanguageSnippets: extractMandatoryLanguageSnippets(scanned),
    descriptionTooShort: (rawDescription || '').trim().length < 400,
    scannedChars: scanned.length,
    requiresUsLocation,
    requiresSpecificUsCity,
    requiresUsCitizen,
    impliesUsOnly,
    usOnlySignals,
    mentionsOpenToInternational,
  }
}

function renderFactsBlock(facts: JdFacts): string {
  const lines: string[] = []
  lines.push(`description_chars_scanned: ${facts.scannedChars}`)
  if (facts.descriptionTooShort) lines.push(`description_too_short: true`)
  if (facts.requiredLocations.length > 0) {
    lines.push(`required_locations: ${facts.requiredLocations.join(' | ')}`)
  }
  if (facts.onsiteCityPhrases.length > 0) {
    lines.push(
      `onsite_city_phrases: ${facts.onsiteCityPhrases
        .slice(0, 3)
        .map((s) => JSON.stringify(s))
        .join(' | ')}`
    )
  }
  if (facts.requiresOnSiteOrHybrid) lines.push(`requires_onsite_or_hybrid: true`)
  if (facts.mentionsRemoteFriendly) lines.push(`mentions_remote_friendly: true`)
  if (facts.mentionsRelocation) lines.push(`mentions_relocation: true`)
  if (facts.requiresClearance) lines.push(`requires_clearance: true`)
  if (facts.requiredCitizenships.length > 0) {
    lines.push(`required_citizenships: ${facts.requiredCitizenships.join(', ')}`)
  }
  if (facts.w2Only) lines.push(`w2_only: true`)
  if (facts.noSponsorship) lines.push(`no_visa_sponsorship: true`)
  if (facts.sponsorshipAvailable) lines.push(`sponsorship_available: true`)
  if (facts.maxYearsRequired > 0) lines.push(`max_years_required: ${facts.maxYearsRequired}`)
  if (facts.hasSeniorityTitleHint) lines.push(`mentions_senior_titles: true`)
  if (facts.hasJuniorTitleHint) lines.push(`mentions_junior_titles: true`)
  if (facts.mandatoryLanguageSnippets.length > 0) {
    lines.push(
      `mandatory_language_snippets: ${facts.mandatoryLanguageSnippets
        .slice(0, 3)
        .map((s) => JSON.stringify(s))
        .join(' | ')}`
    )
  }
  if (facts.impliesUsOnly) {
    lines.push(`implies_us_only_employment: true (${facts.usOnlySignals.join(', ')})`)
  }
  if (facts.mentionsOpenToInternational) {
    lines.push(`mentions_open_to_international: true`)
  }
  return lines.length === 1
    ? `${lines[0]}\nno_deal_breaker_patterns_detected: true`
    : lines.join('\n')
}

export function buildSmartJdExcerpt(
  rawDescription: string | null | undefined
): SmartJdExcerpt {
  const raw = rawDescription || ''
  const head = raw.slice(0, HEAD_CHARS)

  const scanned = raw.slice(0, SCAN_MAX_CHARS)
  const signals = collectSignalSentences(scanned)

  const headSet = new Set<string>()
  for (const s of head.split(SENTENCE_SPLIT_RE)) {
    const t = s.trim().slice(0, 220)
    if (t) headSet.add(t)
  }
  const extras = signals.filter((s) => !headSet.has(s))

  const facts = analyzeJd(rawDescription)

  const factsHeader = `[Detected JD facts]\n${renderFactsBlock(facts)}\n[/Detected JD facts]\n`

  const opener = head.trim()
  const bullets =
    extras.length > 0
      ? `\n[Additional signal sentences found later in JD]\n- ${extras.join('\n- ')}\n`
      : ''

  const combined = `${factsHeader}\n${opener}${bullets}`
  const excerpt =
    combined.length <= EXCERPT_MAX_CHARS ? combined : combined.slice(0, EXCERPT_MAX_CHARS - 1) + '…'

  return {
    facts,
    excerpt,
    excerptChars: excerpt.length,
    extraSignalSentencesAppended: extras.length,
  }
}
