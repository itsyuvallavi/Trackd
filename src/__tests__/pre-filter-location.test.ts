import { describe, expect, it } from 'vitest'
import type { BotConfig } from '@prisma/client'
import { preFilterJob } from '@/lib/bot/pre-filter'
import type { SearchJobResult } from '@/lib/bot/types'

function cfg(locations: string[], remoteOnly = false): BotConfig {
  return { locations, experienceLevel: 'any', remoteOnly } as BotConfig
}

function job(partial: Partial<SearchJobResult> & Pick<SearchJobResult, 'title' | 'company'>): SearchJobResult {
  return {
    title: partial.title,
    company: partial.company,
    location: partial.location ?? null,
    url: partial.url ?? 'https://example.com/job',
    description: partial.description ?? null,
    source: partial.source ?? 'jobs_search_api',
    is_remote: partial.is_remote ?? null,
    jobBoard: partial.jobBoard ?? null,
    posted_date: partial.posted_date ?? null,
    salary_min: partial.salary_min ?? null,
    salary_max: partial.salary_max ?? null,
    salary_currency: partial.salary_currency ?? null,
    job_type: partial.job_type ?? null,
    company_logo: partial.company_logo ?? null,
  }
}

describe('preFilterJob remote-first Europe', () => {
  it('allows UK employer when listing is remote and user has Europe + Portugal', () => {
    const r = preFilterJob(
      job({
        title: 'Full Stack Engineer',
        company: 'Acme',
        location: 'London, England, UK',
        is_remote: true,
      }),
      cfg(['Portugal', 'Europe']),
    )
    expect(r.rejected).toBe(false)
  })

  it('rejects hybrid/on-site London when user did not list London for in-person work', () => {
    const r = preFilterJob(
      job({
        title: 'Full Stack Engineer',
        company: 'Acme',
        location: 'London, England, UK',
        is_remote: false,
        description:
          'We build APIs. Hybrid work required 3 days per week in our London office. Stack: React, Node, PostgreSQL.',
      }),
      cfg(['Portugal', 'Europe']),
    )
    expect(r.rejected).toBe(true)
    if (r.rejected) expect(r.flag).toBe('wrong_location')
  })

  it('applies remote-first when user only lists Portugal (no Europe token)', () => {
    const r = preFilterJob(
      job({
        title: 'Full Stack Engineer',
        company: 'Acme',
        location: 'London, England, UK',
        is_remote: false,
        description:
          'We ship fintech tools. Hybrid work required 3 days per week in our London office.',
      }),
      cfg(['Portugal', 'Lisbon', 'Porto']),
    )
    expect(r.rejected).toBe(true)
  })

  it('rejects empty description and non-remote listing for remote-first user (thin LATAM-style rows)', () => {
    const r = preFilterJob(
      job({
        title: 'Pessoa Desenvolvedora Full Stack',
        company: 'Globo',
        location: null,
        is_remote: false,
        description: null,
      }),
      cfg(['Portugal', 'Europe']),
    )
    expect(r.rejected).toBe(true)
    if (r.rejected) expect(r.flag).toBe('wrong_location')
  })

  it('allows thin JD when listing is explicitly remote', () => {
    const r = preFilterJob(
      job({
        title: 'Full Stack Engineer',
        company: 'Acme',
        location: 'Remote',
        is_remote: true,
        description: '',
      }),
      cfg(['Portugal', 'Europe']),
    )
    expect(r.rejected).toBe(false)
  })

  it('allows hybrid when JD ties on-site to a city the user listed (e.g. Lisbon)', () => {
    const r = preFilterJob(
      job({
        title: 'Full Stack Engineer',
        company: 'Acme',
        location: 'Lisbon, Portugal',
        is_remote: false,
        description:
          'Product team in Lisbon. Hybrid work required 2 days per week in our Lisbon office. React and TypeScript.',
      }),
      cfg(['Portugal', 'Europe', 'Lisbon']),
    )
    expect(r.rejected).toBe(false)
  })
})

describe('preFilterJob location (US remote HQ)', () => {
  it('rejects US office location for EU-only targets even when is_remote', () => {
    const r = preFilterJob(
      job({
        title: 'Engineer',
        company: 'Premier',
        location: 'Charlotte, NC, US',
        is_remote: true,
      }),
      cfg(['Portugal', 'Remote']),
    )
    expect(r.rejected).toBe(true)
    if (r.rejected) expect(r.flag).toBe('wrong_location')
  })

  it('allows US when user lists United States', () => {
    const r = preFilterJob(
      job({
        title: 'Engineer',
        company: 'Premier',
        location: 'Charlotte, NC, US',
        is_remote: true,
      }),
      cfg(['United States']),
    )
    expect(r.rejected).toBe(false)
  })

  it('allows remote-only listing with no geography when user has only Remote', () => {
    const r = preFilterJob(
      job({
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        is_remote: true,
      }),
      cfg(['Remote']),
    )
    expect(r.rejected).toBe(false)
  })

  it('rejects remote-qualified India listing when target locations exclude India', () => {
    const r = preFilterJob(
      job({
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote - India',
        is_remote: true,
        description:
          'Remote role for engineers based in India. TypeScript, React, and API experience required.',
      }),
      cfg(['Portugal'], true),
    )
    expect(r.rejected).toBe(true)
    if (r.rejected) expect(r.flag).toBe('wrong_location')
  })

  it('allows remote-qualified India listing when user lists India', () => {
    const r = preFilterJob(
      job({
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote - India',
        is_remote: true,
      }),
      cfg(['India'], true),
    )
    expect(r.rejected).toBe(false)
  })
})
