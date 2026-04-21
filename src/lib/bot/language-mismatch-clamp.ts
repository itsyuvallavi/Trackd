/**
 * Down-rank listings that mandate spoken languages the user does not list in BotConfig.
 */

import type { JobEvaluation, SearchJobResult } from './types'

export type LanguageMismatchClampMeta = {
  applied: boolean
  beforeScore: number
  afterScore: number
  reasons: string[]
}

const JD_WINDOW = 12000

/** Below typical minScore when the JD mandates a language outside the user's allowlist. */
const LANGUAGE_FIT_CAP = 28

/** Canonical codes → regexes that detect the language in a job description (English names + common native spellings). */
const LANGUAGE_DETECTORS: Array<{ code: string; label: string; test: (s: string) => boolean }> = [
  {
    code: 'en',
    label: 'English',
    test: (s) => /\benglish\b/i.test(s) || /\benglisch\b/i.test(s),
  },
  {
    code: 'he',
    label: 'Hebrew',
    test: (s) => /\b(?:hebrew|עברית)\b/i.test(s),
  },
  {
    code: 'fr',
    label: 'French',
    test: (s) => /\b(?:french|français|francais)\b/i.test(s),
  },
  {
    code: 'de',
    label: 'German',
    test: (s) => /\b(?:german|deutsch)\b/i.test(s),
  },
  {
    code: 'es',
    label: 'Spanish',
    test: (s) => /\b(?:spanish|español|espanol|castilian)\b/i.test(s),
  },
  {
    code: 'it',
    label: 'Italian',
    test: (s) => /\b(?:italian|italiano)\b/i.test(s),
  },
  {
    code: 'pt',
    label: 'Portuguese',
    test: (s) => /\b(?:portuguese|português|portugues)\b/i.test(s),
  },
  {
    code: 'nl',
    label: 'Dutch',
    test: (s) => /\b(?:dutch|nederlands)\b/i.test(s),
  },
  {
    code: 'pl',
    label: 'Polish',
    test: (s) => /\bPolish\b/.test(s) || /\bpolski\b/i.test(s),
  },
  {
    code: 'sv',
    label: 'Swedish',
    test: (s) => /\b(?:swedish|svenska)\b/i.test(s),
  },
  {
    code: 'da',
    label: 'Danish',
    test: (s) => /\b(?:danish|dansk)\b/i.test(s),
  },
  {
    code: 'no',
    label: 'Norwegian',
    test: (s) => /\b(?:norwegian|norsk)\b/i.test(s),
  },
  {
    code: 'fi',
    label: 'Finnish',
    test: (s) => /\b(?:finnish|suomi)\b/i.test(s),
  },
  {
    code: 'cs',
    label: 'Czech',
    test: (s) => /\b(?:czech|čeština|cestina)\b/i.test(s),
  },
  {
    code: 'ro',
    label: 'Romanian',
    test: (s) => /\b(?:romanian|română|romana)\b/i.test(s),
  },
  {
    code: 'el',
    label: 'Greek',
    test: (s) => /\b(?:greek|ελληνικά)\b/i.test(s),
  },
  {
    code: 'ru',
    label: 'Russian',
    test: (s) => /\b(?:russian|русск)\b/i.test(s),
  },
  {
    code: 'uk',
    label: 'Ukrainian',
    test: (s) => /\b(?:ukrainian|україн)\b/i.test(s),
  },
  {
    code: 'tr',
    label: 'Turkish',
    test: (s) => /\b(?:turkish|türkçe|turkce)\b/i.test(s),
  },
  {
    code: 'ar',
    label: 'Arabic',
    test: (s) => /\b(?:arabic|العربية)\b/i.test(s),
  },
  {
    code: 'zh',
    label: 'Chinese',
    test: (s) => /\b(?:mandarin|cantonese|chinese|中文)\b/i.test(s),
  },
  {
    code: 'ja',
    label: 'Japanese',
    test: (s) => /\b(?:japanese|日本語)\b/i.test(s),
  },
  {
    code: 'ko',
    label: 'Korean',
    test: (s) => /\b(?:korean|한국어)\b/i.test(s),
  },
  {
    code: 'hi',
    label: 'Hindi',
    test: (s) => /\bhindi\b/i.test(s),
  },
]

const TOKEN_ALIASES: Record<string, string> = {
  english: 'en',
  en: 'en',
  anglais: 'en',
  hebrew: 'he',
  he: 'he',
  עברית: 'he',
  french: 'fr',
  fr: 'fr',
  français: 'fr',
  francais: 'fr',
  german: 'de',
  de: 'de',
  deutsch: 'de',
  spanish: 'es',
  es: 'es',
  español: 'es',
  espanol: 'es',
  italian: 'it',
  it: 'it',
  italiano: 'it',
  portuguese: 'pt',
  pt: 'pt',
  português: 'pt',
  portugues: 'pt',
  dutch: 'nl',
  nl: 'nl',
  nederlands: 'nl',
  polish: 'pl',
  pl: 'pl',
  swedish: 'sv',
  sv: 'sv',
  svenska: 'sv',
  danish: 'da',
  da: 'da',
  dansk: 'da',
  norwegian: 'no',
  no: 'no',
  norsk: 'no',
  finnish: 'fi',
  fi: 'fi',
  suomi: 'fi',
  czech: 'cs',
  cs: 'cs',
  romanian: 'ro',
  ro: 'ro',
  greek: 'el',
  el: 'el',
  russian: 'ru',
  ru: 'ru',
  ukrainian: 'uk',
  uk: 'uk',
  turkish: 'tr',
  tr: 'tr',
  arabic: 'ar',
  ar: 'ar',
  chinese: 'zh',
  zh: 'zh',
  mandarin: 'zh',
  japanese: 'ja',
  ja: 'ja',
  korean: 'ko',
  ko: 'ko',
  hindi: 'hi',
  hi: 'hi',
}

/**
 * Maps free-form tags from bot settings ("English", "hebrew", "fr") to canonical codes.
 * Returns null when empty → caller should skip language clamping.
 */
export function normalizeSpokenLanguageAllowlist(raw: string[]): Set<string> | null {
  const codes = new Set<string>()
  for (const entry of raw) {
    const pieces = entry
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const piece of pieces) {
      const key = piece.toLowerCase().replace(/\s+/g, ' ')
      const code = TOKEN_ALIASES[key]
      if (code) codes.add(code)
    }
  }
  return codes.size === 0 ? null : codes
}

function requirementContext(text: string): boolean {
  return (
    /\b(?:mandatory|required|must\s+(?:speak|have|be\s+fluent)|must\s+be\s+fluent|fluent\s+in|native\s+(?:speaker\s+)?(?:of|in)?|professional\s+proficiency|business\s+level|bilingual\s+in)\b/i.test(
      text
    ) || /\b(?:both\s+)?(?:written\s+and\s+)?verbal\s*\([^)]*\bmandatory\b/i.test(text)
  )
}

/**
 * Languages detected in `text` that are stated in a requirement context (same line / nearby).
 */
function requiredLanguagesInChunk(chunk: string, allowed: Set<string>): string[] {
  const lower = chunk.toLowerCase()
  if (!requirementContext(chunk) && !/\bmandatory\b/i.test(chunk)) return []

  const found: string[] = []
  for (const { code, label, test } of LANGUAGE_DETECTORS) {
    if (allowed.has(code)) continue
    if (!test(chunk)) continue
    found.push(label)
  }
  return found
}

function findMandatoryLanguageGaps(jdRaw: string, allowed: Set<string>): string[] {
  const jd = jdRaw.slice(0, JD_WINDOW)
  const gaps = new Set<string>()

  const chunks = jd.split(/\n+/)
  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (trimmed.length < 12) continue
    for (const label of requiredLanguagesInChunk(trimmed, allowed)) {
      gaps.add(label)
    }
  }

  // Multi-sentence paragraphs: split further
  if (gaps.size === 0) {
    const rough = jd.split(/(?<=[.!?])\s+/)
    for (const sentence of rough) {
      if (sentence.length < 20) continue
      if (!requirementContext(sentence) && !/\bmandatory\b/i.test(sentence)) continue
      for (const { code, label, test } of LANGUAGE_DETECTORS) {
        if (allowed.has(code)) continue
        if (test(sentence)) gaps.add(label)
      }
    }
  }

  return [...gaps]
}

export function applyLanguageMismatchClamp(
  job: SearchJobResult,
  evaluation: JobEvaluation,
  minScore: number,
  allowedLanguageCodes: Set<string> | null
): { evaluation: JobEvaluation; clampMeta?: LanguageMismatchClampMeta } {
  if (!allowedLanguageCodes || !job.description?.trim()) {
    return { evaluation }
  }

  const gaps = findMandatoryLanguageGaps(job.description, allowedLanguageCodes)
  if (gaps.length === 0) {
    return { evaluation }
  }

  const beforeScore = evaluation.score
  const afterScore = Math.min(beforeScore, LANGUAGE_FIT_CAP)
  if (afterScore >= beforeScore) {
    return { evaluation }
  }

  const flags = Array.from(new Set([...evaluation.flags, 'missing_required_language']))
  const reason = `listing mandates other language(s) (${gaps.join(', ')}) not in your spoken-language list`
  const note = ` [Match score adjusted: ${reason}.]`
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
      reasons: [reason],
    },
  }
}
