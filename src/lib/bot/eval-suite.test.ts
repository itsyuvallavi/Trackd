import { describe, expect, it } from 'vitest'
import { BOT_EVAL_PERSONAS } from './eval-suite-fixtures'
import { runDeterministicBotEvalSuite } from './eval-suite'

describe('bot eval suite fixtures', () => {
  it('covers the intended multi-persona dogfood set', () => {
    expect(BOT_EVAL_PERSONAS.map((persona) => persona.id)).toEqual([
      'frontend-react-europe',
      'fullstack-typescript-product',
      'python-ml-data-scientist',
      'product-manager',
      'qa-automation',
      'devops-sre',
      'ux-product-designer',
      'entry-level-software',
    ])
  })

  it('passes the provider-free deterministic eval suite', () => {
    const result = runDeterministicBotEvalSuite()

    expect(result.passed).toBe(true)
    expect(result.totals.personas).toBeGreaterThanOrEqual(8)
    expect(result.totals.failedChecks).toBe(0)
  })

  it('keeps every persona on parsed Job Search resume evidence', () => {
    const result = runDeterministicBotEvalSuite()

    for (const persona of result.personas) {
      expect(persona.source.kind).toBe('parsed_resume')
      expect(persona.source.resumeId).toMatch(/^eval_resume_/)
      expect(persona.safeTerms).toEqual(expect.arrayContaining(persona.expectedSafeTerms))
    }
  })

  it('does not leak contact details or raw resume blobs into safe search terms', () => {
    const result = runDeterministicBotEvalSuite()

    for (const persona of result.personas) {
      const text = persona.safeTerms.join(' ')
      expect(text).not.toMatch(/@|https?:|www\.|\+\d{2,}/i)
      expect(persona.safeTerms.every((term) => term.split(/\s+/).length <= 4)).toBe(true)
    }
  })

  it('keeps settings as constraints instead of replacing resume skills', () => {
    for (const persona of runDeterministicBotEvalSuite().personas) {
      expect(persona.safeTerms).toEqual(expect.arrayContaining(persona.expectedSafeTerms))
      expect(persona.safeTerms.length).toBeGreaterThan(0)
      expect(persona.safeTerms.length).toBeLessThanOrEqual(5)
    }
  })
})
