import type { BotConfig } from '@prisma/client'
import { BOT_SEARCH_KEYWORD_OR_MAX } from './search-constants'
import type { CandidateProfile } from './candidate-profile'

type SearchProfileConfig = Pick<BotConfig, 'keywords'>

export type SafeSearchProfile = {
  terms: string[]
  resumeSearchTerms: string[]
  settingsKeywords: string[]
  derivedFromResume: boolean
  profileSource: {
    kind: string
    label: string
    resumeId: string | null
    resumeLabel: string | null
  }
}

export function normalizeSearchTermKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = normalizeSearchTermKey(trimmed)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

export function refineSearchKeywordForProvider(raw: string): string {
  const term = raw.trim()
  const text = normalizeSearchTermKey(term)

  if (/\bproduct engineer\b/.test(text)) {
    return /\bfull[-\s]*stack\b|\bfullstack\b/.test(text)
      ? 'Full Stack Product Engineer'
      : 'Software Product Engineer'
  }

  if (/\breact\b/.test(text)) {
    return /\btypescript\b|\bts\b/.test(text) ? term : 'React TypeScript Developer'
  }

  if (/\bnext(?:\s*js|js)\b/.test(text)) {
    return /\bfront(?:end| end)\b/.test(text) ? term : 'Next.js Frontend Engineer'
  }

  if (/\bfront(?:end| end)\b/.test(text)) {
    return /\bengineer\b/.test(text) ? term : 'Frontend Engineer'
  }

  if (/\bfull[-\s]*stack\b|\bfullstack\b/.test(text)) {
    return 'Full Stack Engineer'
  }

  if (
    /\bai engineer\b|\bartificial intelligence engineer\b|\bgenai engineer\b|\bgenerative ai engineer\b/.test(
      text
    )
  ) {
    return 'LLM Engineer'
  }

  if (/\bmachine learning\b|\bml engineer\b/.test(text)) {
    return 'Machine Learning Engineer'
  }

  if (/\bdata scientist\b|\bdata science\b/.test(text)) {
    return 'Data Scientist'
  }

  if (/\bsdet\b/.test(text)) {
    return 'SDET'
  }

  if (/\bplaywright\b/.test(text)) {
    return 'Playwright QA Engineer'
  }

  if (/\btest automation\b/.test(text)) {
    return 'Test Automation Engineer'
  }

  if (/\bqa\b|\bquality assurance\b/.test(text)) {
    return 'QA Automation Engineer'
  }

  if (/\bsre\b|\bsite reliability\b/.test(text)) {
    return /\bsre\b/.test(text) && !/\bsite reliability\b/.test(text) ? 'SRE' : 'Site Reliability Engineer'
  }

  if (/\bplatform engineer\b|\bplatform engineering\b/.test(text)) {
    return 'Platform Engineer'
  }

  if (/\bcloud infrastructure engineer\b/.test(text)) {
    return 'Cloud Infrastructure Engineer'
  }

  if (/\binfrastructure engineer\b/.test(text)) {
    return 'Infrastructure Engineer'
  }

  if (/\breliability engineer\b/.test(text)) {
    return 'Reliability Engineer'
  }

  if (/\bdevops\b/.test(text)) {
    return 'DevOps Engineer'
  }

  if (/\bproduct manager\b|\bproduct management\b|\bpm\b/.test(text)) {
    if (/\bb2b\b/.test(text) && /\bsaas\b/.test(text)) return 'B2B SaaS Product Manager'
    if (/\bplatform\b/.test(text)) return 'Platform Product Manager'
    return 'Product Manager'
  }

  if (/\bproduct designer\b/.test(text)) {
    return 'Product Designer'
  }

  if (/\bux\b|\buser experience\b/.test(text)) {
    return 'UX Designer'
  }

  if (/\bentry level\b|\bentry-level\b|\bjunior\b|\bgraduate\b/.test(text)) {
    return 'Junior Software Engineer'
  }

  return term
}

function settingsIntents(settingsKeywords: string[]): Set<string> {
  const text = normalizeSearchTermKey(settingsKeywords.join(' '))
  const intents = new Set<string>()

  if (hasAny(text, [/\breact\b/, /\bnext js\b/, /\bfront(?:end| end)\b/, /\bui\b/, /\bweb\b/])) {
    intents.add('frontend')
  }
  if (hasAny(text, [/\bfull[-\s]*stack\b/, /\bfullstack\b/, /\bbackend\b/, /\bapi\b/, /\bproduct engineer\b/])) {
    intents.add('fullstack')
  }
  if (hasAny(text, [/\bai\b/, /\bllm\b/, /\bgenai\b/, /\bgenerative ai\b/, /\bdeveloper tooling\b/])) {
    intents.add('ai')
  }
  if (hasAny(text, [/\bdata scientist\b/, /\bdata science\b/, /\bmachine learning\b/, /\bml\b/, /\bpython\b/])) {
    intents.add('data')
  }
  if (hasAny(text, [/\bproduct manager\b/, /\bproduct management\b/, /\bpm\b/, /\broadmap\b/])) {
    intents.add('product')
  }
  if (hasAny(text, [/\bqa\b/, /\bquality assurance\b/, /\btest automation\b/, /\btester\b/, /\bsdet\b/, /\bplaywright\b/])) {
    intents.add('qa')
  }
  if (hasAny(text, [/\bdevops\b/, /\bsre\b/, /\bsite reliability\b/, /\bplatform\b/, /\binfrastructure\b/])) {
    intents.add('devops')
  }
  if (hasAny(text, [/\bux\b/, /\bproduct designer\b/, /\buser experience\b/, /\bdesign\b/])) {
    intents.add('design')
  }
  if (hasAny(text, [/\bsoftware engineer\b/, /\bjunior\b/, /\bentry level\b/, /\bentry-level\b/, /\bgraduate\b/])) {
    intents.add('software')
  }

  return intents
}

function termMatchesIntent(term: string, intents: Set<string>): boolean {
  if (intents.size === 0) return true
  const text = normalizeSearchTermKey(term)

  if (
    intents.has('frontend') &&
    hasAny(text, [/\breact\b/, /\bnext js\b/, /\bfront(?:end| end)\b/, /\bui\b/, /\bweb\b/])
  ) {
    return true
  }

  if (
    intents.has('fullstack') &&
    hasAny(text, [
      /\bfull[-\s]*stack\b/,
      /\bfullstack\b/,
      /\bbackend\b/,
      /\bapi\b/,
      /\bnode js\b/,
      /\bproduct engineer\b/,
      /\bprisma\b/,
      /\bpostgresql\b/,
    ])
  ) {
    return true
  }

  if (
    intents.has('ai') &&
    hasAny(text, [/\bllm\b/, /\bai\b/, /\bdeveloper tooling\b/, /\bproduct\b/])
  ) {
    return true
  }

  if (
    intents.has('data') &&
    hasAny(text, [/\bdata scientist\b/, /\bmachine learning\b/, /\bml\b/, /\bpython\b/])
  ) {
    return true
  }

  if (
    intents.has('product') &&
    hasAny(text, [/\bproduct manager\b/, /\bproduct management\b/, /\bproduct\b/])
  ) {
    return true
  }

  if (
    intents.has('qa') &&
    hasAny(text, [
      /\bqa\b/,
      /\bquality assurance\b/,
      /\btest automation\b/,
      /\bsoftware engineer in test\b/,
      /\btest engineer\b/,
      /\bautomation\b/,
      /\bsdet\b/,
      /\bplaywright\b/,
    ])
  ) {
    return true
  }

  if (
    intents.has('devops') &&
    hasAny(text, [
      /\bdevops\b/,
      /\bsite reliability\b/,
      /\bsre\b/,
      /\bplatform\b/,
      /\binfrastructure\b/,
      /\bcloud\b/,
      /\bkubernetes\b/,
      /\bterraform\b/,
    ])
  ) {
    return true
  }

  if (
    intents.has('design') &&
    hasAny(text, [/\bux\b/, /\bproduct designer\b/, /\buser experience\b/, /\bdesigner\b/])
  ) {
    return true
  }

  if (
    intents.has('software') &&
    hasAny(text, [/\bsoftware engineer\b/, /\bjunior\b/, /\bentry level\b/, /\bgraduate\b/])
  ) {
    return true
  }

  return false
}

export function deriveSafeResumeSearchTerms(profile: CandidateProfile | null): string[] {
  if (!profile?.resume) return []
  if (profile.source.kind !== 'parsed_resume' && profile.source.kind !== 'raw_resume_fallback') {
    return []
  }

  const skills = Array.isArray(profile.resume.skills) ? profile.resume.skills.join(' ') : ''
  const summary = typeof profile.resume.summary === 'string' ? profile.resume.summary : ''
  const experienceText = Array.isArray(profile.resume.experience)
    ? profile.resume.experience
        .slice(0, 4)
        .map((entry) =>
          [
            typeof entry?.title === 'string' ? entry.title : '',
            typeof entry?.description === 'string' ? entry.description : '',
          ].join(' ')
        )
        .join(' ')
    : ''
  const text = normalizeSearchTermKey([skills, summary, experienceText].join(' '))
  const terms: string[] = []

  const hasReact = hasAny(text, [/\breact\b/])
  const hasNext = hasAny(text, [/\bnext js\b/])
  const hasTypeScript = hasAny(text, [/\btypescript\b/, /\bjavascript\b/])
  const hasFrontend = hasAny(text, [/\bfront(?:end| end)\b/, /\bcss\b/, /\btailwind\b/, /\bui\b/])
  const hasFullstack = hasAny(text, [
    /\bfull[-\s]*stack\b/,
    /\bfullstack\b/,
    /\bnext js\b/,
    /\bnode js\b/,
    /\brest apis?\b/,
    /\bprisma\b/,
    /\bpostgresql\b/,
    /\bsupabase\b/,
    /\bfirebase\b/,
  ])
  const hasBackendTypeScript = hasTypeScript && hasAny(text, [
    /\bbackend\b/,
    /\bnode js\b/,
    /\brest apis?\b/,
    /\bprisma\b/,
    /\bpostgresql\b/,
    /\bsupabase\b/,
    /\bfirebase\b/,
  ])
  const hasProductEngineer = hasAny(text, [
    /\bproduct engineer\b/,
    /\bproduct minded\b/,
    /\bproduct focused\b/,
    /\bsaas product\b/,
  ])
  const hasLlm = hasAny(text, [
    /\bllm\b/,
    /\blocal llms?\b/,
    /\blarge language models?\b/,
    /\bcontext retrieval\b/,
    /\bagentic\b/,
    /\beval harness/,
  ])
  const hasDeveloperTooling = hasAny(text, [
    /\bdeveloper tooling\b/,
    /\bterminal ui\b/,
    /\bworkflow automation\b/,
    /\bbrowser automation\b/,
  ])
  const hasDataScience = hasAny(text, [
    /\bdata science\b/,
    /\bdata scientist\b/,
    /\bstatistical model/,
    /\bpandas\b/,
    /\bnumpy\b/,
  ])
  const hasMachineLearning = hasAny(text, [
    /\bmachine learning\b/,
    /\bml\b/,
    /\bpython\b/,
    /\bpytorch\b/,
    /\btensorflow\b/,
    /\bscikit\b/,
  ])
  const hasProductManagement = hasAny(text, [
    /\bproduct management\b/,
    /\bproduct manager\b/,
    /\broadmap\b/,
    /\bdiscovery\b/,
    /\buser stories\b/,
    /\bstakeholder\b/,
  ])
  const hasB2BSaasProduct = hasAny(text, [
    /\bb2b\b/,
    /\bsaas\b/,
  ])
  const hasPlatformProduct = hasAny(text, [
    /\bplatform\b/,
    /\binternal tools?\b/,
  ])
  const hasQaAutomation = hasAny(text, [
    /\bqa\b/,
    /\bquality assurance\b/,
    /\btest automation\b/,
    /\bplaywright\b/,
    /\bcypress\b/,
    /\bselenium\b/,
    /\bsdet\b/,
  ])
  const hasBrowserAutomation = hasAny(text, [
    /\bplaywright\b/,
    /\bcypress\b/,
    /\bselenium\b/,
    /\bbrowser automation\b/,
    /\bend to end\b/,
    /\be2e\b/,
  ])
  const hasDevOps = hasAny(text, [
    /\bdevops\b/,
    /\bkubernetes\b/,
    /\bterraform\b/,
    /\baws\b/,
    /\bci cd\b/,
    /\bgithub actions\b/,
  ])
  const hasSre = hasAny(text, [
    /\bsre\b/,
    /\bsite reliability\b/,
    /\bobservability\b/,
    /\bincident response\b/,
  ])
  const hasPlatformEngineering = hasAny(text, [
    /\bplatform engineer\b/,
    /\bplatform engineering\b/,
    /\bdeveloper platform\b/,
    /\bplatform reliability\b/,
  ])
  const hasCloudInfrastructure = hasAny(text, [
    /\bcloud infrastructure\b/,
    /\bcloud native\b/,
    /\bkubernetes\b/,
    /\bterraform\b/,
    /\baws\b/,
  ])
  const hasUxDesign = hasAny(text, [
    /\bux\b/,
    /\buser experience\b/,
    /\bfigma\b/,
    /\bwireframes?\b/,
    /\buser research\b/,
  ])
  const hasProductDesign = hasAny(text, [
    /\bproduct designer\b/,
    /\bproduct design\b/,
    /\binteraction design\b/,
    /\bprototype\b/,
  ])
  const hasDesignSystems = hasAny(text, [
    /\bdesign systems?\b/,
    /\bcomponent librar/,
    /\baccessibility\b/,
  ])
  const hasGeneralSoftware = hasAny(text, [
    /\bsoftware engineer\b/,
    /\bcomputer science\b/,
    /\bdata structures\b/,
    /\balgorithms\b/,
    /\bcapstone\b/,
  ])
  const hasEntryLevel = hasAny(text, [
    /\bentry level\b/,
    /\bentry-level\b/,
    /\bjunior\b/,
    /\bgraduate\b/,
    /\binternship\b/,
  ])

  if (hasReact && hasTypeScript) terms.push('React TypeScript Developer')
  if (hasNext && (hasFrontend || hasReact)) terms.push('Next.js Frontend Engineer')
  if ((hasFrontend || hasReact || hasNext) && hasTypeScript) terms.push('Frontend Engineer')
  if (hasFullstack && hasTypeScript) terms.push('Full Stack Engineer')
  if (hasBackendTypeScript) terms.push('Backend TypeScript Engineer')
  if (hasProductEngineer && (hasTypeScript || hasFullstack)) terms.push('Full Stack Product Engineer')
  if (hasLlm) terms.push('LLM Engineer')
  if (hasLlm || hasDeveloperTooling) terms.push('AI Product Engineer')
  if (hasDeveloperTooling) terms.push('Developer Tooling Engineer')
  if (hasDataScience) terms.push('Data Scientist')
  if (hasMachineLearning) terms.push('Machine Learning Engineer')
  if (hasProductManagement && hasB2BSaasProduct) terms.push('B2B SaaS Product Manager')
  if (hasProductManagement && hasPlatformProduct) terms.push('Platform Product Manager')
  if (hasProductManagement) terms.push('Product Manager')
  if (hasQaAutomation) terms.push('QA Automation Engineer')
  if (hasQaAutomation && hasBrowserAutomation) terms.push('Software Engineer in Test')
  if (hasQaAutomation && hasBrowserAutomation) terms.push('Test Automation Engineer')
  if (hasQaAutomation && hasBrowserAutomation) terms.push('SDET')
  if (hasQaAutomation && hasAny(text, [/\bplaywright\b/])) terms.push('Playwright QA Engineer')
  if (hasSre) terms.push('Site Reliability Engineer')
  if (hasSre) terms.push('SRE')
  if (hasPlatformEngineering) terms.push('Platform Engineer')
  if (hasDevOps && hasCloudInfrastructure) terms.push('Cloud Infrastructure Engineer')
  if (hasDevOps) terms.push('DevOps Engineer')
  if (hasProductDesign && hasUxDesign) terms.push('UX Product Designer')
  if (hasUxDesign) terms.push('UI UX Designer')
  if (hasDesignSystems && (hasProductDesign || hasUxDesign)) terms.push('Design Systems Designer')
  if (hasProductDesign) terms.push('Product Designer')
  if (hasUxDesign) terms.push('UX Designer')
  if (hasGeneralSoftware) terms.push('Software Engineer')
  if (hasEntryLevel) terms.push('Junior Software Engineer')

  return uniqueStrings(terms)
}

export function buildSafeSearchTerms(input: {
  settingsKeywords: string[]
  resumeSearchTerms?: string[]
  maxTerms?: number
}): string[] {
  const maxTerms = Math.max(1, input.maxTerms ?? BOT_SEARCH_KEYWORD_OR_MAX)
  const settingsKeywords = uniqueStrings(input.settingsKeywords)
  const resumeSearchTerms = uniqueStrings(input.resumeSearchTerms ?? [])
  const intents = settingsIntents(settingsKeywords)
  const alignedResumeTerms = resumeSearchTerms.filter((term) => termMatchesIntent(term, intents))

  if (resumeSearchTerms.length > 0) {
    const constrainedResumeTerms = alignedResumeTerms.length > 0 ? alignedResumeTerms : resumeSearchTerms
    return constrainedResumeTerms.slice(0, maxTerms)
  }

  const refinedSettingsTerms = settingsKeywords.map(refineSearchKeywordForProvider)

  const combined = uniqueStrings(refinedSettingsTerms)
  return combined.length > 0 ? combined.slice(0, maxTerms) : []
}

export function buildSafeSearchProfile(input: {
  config: SearchProfileConfig
  candidateProfile: CandidateProfile | null
  maxTerms?: number
}): SafeSearchProfile {
  const resumeSearchTerms = deriveSafeResumeSearchTerms(input.candidateProfile)
  const settingsKeywords = uniqueStrings(input.config.keywords)
  const terms = buildSafeSearchTerms({
    settingsKeywords,
    resumeSearchTerms,
    maxTerms: input.maxTerms,
  })
  const source = input.candidateProfile?.source

  return {
    terms,
    resumeSearchTerms,
    settingsKeywords,
    derivedFromResume: resumeSearchTerms.length > 0,
    profileSource: {
      kind: source?.kind ?? 'none',
      label: source?.label ?? 'No profile source',
      resumeId: source?.resumeId ?? null,
      resumeLabel: source?.resumeLabel ?? null,
    },
  }
}
