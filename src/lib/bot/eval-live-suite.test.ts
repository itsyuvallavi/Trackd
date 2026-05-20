import { describe, expect, it, vi } from 'vitest'
import { BOT_EVAL_PERSONAS } from './eval-suite-fixtures'
import {
  liveDogfoodEnvironmentErrors,
  normalizeLiveDogfoodOptions,
  runLiveBotEvalSuite,
} from './eval-live-suite'
import type { SearchJobResult, SearchResponse } from './types'

function job(partial: Partial<SearchJobResult> = {}): SearchJobResult {
  return {
    title: 'Remote Frontend Engineer',
    company: 'Live Synthetic Co',
    location: 'Remote Europe',
    url: 'https://jobs.example.invalid/live-frontend',
    description:
      'Build React and Next.js interfaces in TypeScript with accessibility, product collaboration, and testing.',
    source: 'jobs_search_api',
    is_remote: true,
    jobBoard: 'linkedin',
    providerPass: null,
    ...partial,
  }
}

function response(jobs: SearchJobResult[]): SearchResponse {
  return {
    jobs,
    meta: {
      platforms_succeeded: ['jobs_search_api'],
      platforms_failed: {},
      fallback_used: false,
      total_raw: jobs.length,
      total_deduped: jobs.length,
      by_source_raw: { jobs_search_api: jobs.length },
      by_source_deduped: { jobs_search_api: jobs.length },
    },
  }
}

describe('live bot eval suite', () => {
  it('fails closed unless live provider and OpenAI env are explicit', () => {
    expect(liveDogfoodEnvironmentErrors({}, { maxAiEvals: 1 })).toEqual([
      'RUN_BOT_EVAL_SUITE_LIVE=1 is required for --live.',
      'JOBS_SEARCH_API_KEY is required for live provider search.',
      'OPENAI_API_KEY is required when maxAiEvals is greater than 0.',
    ])

    expect(
      liveDogfoodEnvironmentErrors(
        {
          RUN_BOT_EVAL_SUITE_LIVE: '1',
          JOBS_SEARCH_API_KEY: 'jobs-key',
          BOT_SEARCH_SOURCES: 'other',
        },
        { maxAiEvals: 0 }
      )
    ).toContain('BOT_SEARCH_SOURCES excludes jobs_search_api, so no live backend would run.')
  })

  it('enforces hard live budget caps', () => {
    expect(() => normalizeLiveDogfoodOptions({ maxAiEvals: 21 })).toThrow(
      'maxAiEvals=21 exceeds live dogfood cap 20'
    )
    expect(() => normalizeLiveDogfoodOptions({ providerMaxAttempts: 4 })).toThrow(
      'providerMaxAttempts=4 exceeds live dogfood cap 3'
    )
    expect(() => normalizeLiveDogfoodOptions({ maxSearchResults: -1 })).toThrow(
      'maxSearchResults must be a non-negative integer'
    )
  })

  it('runs live audit-only with capped search and AI evaluation dependencies', async () => {
    const runSearch = vi.fn().mockResolvedValue(
      response([
        job({ title: 'Remote Frontend Engineer, React and Next.js' }),
        job({
          title: 'Frontend Engineer, Design Systems',
          url: 'https://jobs.example.invalid/live-frontend-2',
          description:
            'Maintain React component libraries and TypeScript design-system workflows for remote product teams.',
        }),
      ])
    )
    const evaluateJob = vi.fn().mockResolvedValue({
      evaluation: {
        score: 88,
        shouldApply: true,
        reasoning: 'The listing asks for "React and Next.js".',
        flags: ['good_match'],
        resumeMatch: 'React, Next.js, TypeScript',
      },
      scoringInputs: {
        model: 'test-model',
        minScoreThreshold: 70,
        userPreferences: {
          keywords: [],
          locations: [],
          remoteOnly: true,
          experienceLevel: null,
          salaryMin: null,
          excludeCompanies: [],
          excludeKeywords: [],
          spokenLanguages: [],
        },
        resumeUsed: {
          resumeId: 'eval_resume_frontend',
          label: 'Frontend React',
          selection: 'parsed_resume',
          sourceKind: 'parsed_resume',
          sourceLabel: 'Parsed resume',
          skillsSentToPrompt: ['React', 'Next.js', 'TypeScript'],
          summaryIncluded: true,
          experienceRolesInPrompt: 1,
          educationRowsInPrompt: 1,
          applicationIdentitySupplemented: true,
          settingsDerivedSignalsUsed: false,
          settingsSignals: [],
          limitations: [],
        },
        profileSource: {
          kind: 'parsed_resume',
          label: 'Parsed resume',
          resumeId: 'eval_resume_frontend',
          resumeLabel: 'Frontend React',
          parsedResumeUsed: true,
          rawResumeTextUsed: true,
          applicationIdentitySupplemented: true,
          settingsDerivedSignalsUsed: false,
          settingsSignals: [],
          limitations: [],
        },
        jobBlockSentToModel: {
          title: 'Remote Frontend Engineer, React and Next.js',
          company: 'Live Synthetic Co',
          location: 'Remote Europe',
          remote: 'Yes',
          salaryLine: 'Not listed',
          jobType: 'Not specified',
          descriptionCharCount: 100,
          descriptionPreview: 'Build React and Next.js interfaces.',
        },
      },
    })

    const report = await runLiveBotEvalSuite({
      personas: [BOT_EVAL_PERSONAS[0]],
      options: {
        maxPersonas: 1,
        maxSearchResults: 2,
        maxAiEvals: 1,
        maxSearchTerms: 1,
        maxLocations: 1,
      },
      deps: { runSearch, evaluateJob },
      now: new Date('2026-05-20T00:00:00.000Z'),
    })

    expect(runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ['React TypeScript Developer'],
        locations: ['Remote Europe'],
        results_wanted: 2,
      })
    )
    expect(evaluateJob).toHaveBeenCalledTimes(1)
    expect(report.auditOnly).toBe(true)
    expect(report.totals).toMatchObject({
      personas: 1,
      jobsFound: 2,
      jobsAudited: 2,
      aiEvaluated: 1,
      wouldSave: 1,
      aiBudgetSkipped: 1,
    })
    expect(report.personas[0].jobs.map((entry) => entry.outcome)).toEqual([
      'would_save',
      'ai_budget_skipped',
    ])
  })

  it('hard-filters off-target live results without consuming AI budget', async () => {
    const runSearch = vi.fn().mockResolvedValue(
      response([
        job({
          title: 'Frontend Engineer',
          location: 'New York, NY, United States',
          is_remote: false,
          description: 'Onsite React role requiring five days per week in New York.',
        }),
      ])
    )
    const evaluateJob = vi.fn()

    const report = await runLiveBotEvalSuite({
      personas: [BOT_EVAL_PERSONAS[0]],
      options: {
        maxPersonas: 1,
        maxSearchResults: 1,
        maxAiEvals: 1,
        maxSearchTerms: 1,
        maxLocations: 1,
      },
      deps: { runSearch, evaluateJob },
    })

    expect(evaluateJob).not.toHaveBeenCalled()
    expect(report.totals).toMatchObject({
      hardFiltered: 1,
      aiEvaluated: 0,
    })
    expect(report.personas[0].jobs[0]).toMatchObject({
      outcome: 'hard_filtered',
      flags: ['wrong_location'],
    })
  })

  it('retries zero-result recoverable provider failures with bounded backoff', async () => {
    const throttled = response([])
    throttled.meta.platforms_failed = {
      jobs_search_api_loc1_term1: 'Jobs Search API HTTP 429: rate limit exceeded',
    }
    const runSearch = vi.fn()
      .mockResolvedValueOnce(throttled)
      .mockResolvedValueOnce(response([job({ title: 'Remote Frontend Engineer, React' })]))
    const evaluateJob = vi.fn().mockResolvedValue({
      evaluation: {
        score: 80,
        shouldApply: true,
        reasoning: 'React frontend role.',
        flags: ['good_match'],
      },
      scoringInputs: null,
    })
    const wait = vi.fn().mockResolvedValue(undefined)

    const report = await runLiveBotEvalSuite({
      personas: [BOT_EVAL_PERSONAS[0]],
      options: {
        maxPersonas: 1,
        maxSearchResults: 1,
        maxAiEvals: 1,
        maxSearchTerms: 1,
        maxLocations: 1,
        providerRetryBackoffMs: 25,
        providerMaxAttempts: 2,
      },
      deps: { runSearch, evaluateJob, sleep: wait },
    })

    expect(runSearch).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(25)
    expect(report.personas[0]).toMatchObject({
      passed: true,
      searchAttempts: 2,
      providerFailureCount: 0,
    })
    expect(report.totals.searchAttempts).toBe(2)
  })

  it('dedupes and ranks live candidates before spending AI budget', async () => {
    const lowCoverage = job({
      title: 'Software Engineer',
      url: 'https://jobs.example.invalid/generic',
      description: 'Build product features for a remote team.',
    })
    const highCoverage = job({
      title: 'Remote Frontend Engineer React TypeScript Next.js',
      company: 'Ranked Product Co',
      url: 'https://jobs.example.invalid/frontend-ranked',
      description:
        'Build React and Next.js product interfaces in TypeScript with frontend accessibility and testing workflows.',
    })
    const duplicateHighCoverage = job({
      ...highCoverage,
      url: 'https://jobs.example.invalid/frontend-ranked-duplicate',
    })
    const runSearch = vi.fn().mockResolvedValue(
      response([lowCoverage, highCoverage, duplicateHighCoverage])
    )
    const evaluateJob = vi.fn().mockResolvedValue({
      evaluation: {
        score: 90,
        shouldApply: true,
        reasoning: 'Strong React frontend match.',
        flags: ['good_match'],
      },
      scoringInputs: null,
    })

    const report = await runLiveBotEvalSuite({
      personas: [BOT_EVAL_PERSONAS[0]],
      options: {
        maxPersonas: 1,
        maxSearchResults: 3,
        maxAiEvals: 1,
        maxSearchTerms: 1,
        maxLocations: 1,
      },
      deps: { runSearch, evaluateJob },
    })

    expect(evaluateJob).toHaveBeenCalledTimes(1)
    expect(evaluateJob.mock.calls[0][0]).toMatchObject({
      title: highCoverage.title,
      company: highCoverage.company,
    })
    expect(report.totals).toMatchObject({
      jobsFound: 3,
      jobsAudited: 2,
      aiEvaluated: 1,
      duplicatesRemoved: 1,
      aiBudgetSkipped: 1,
    })
    expect(report.personas[0].duplicateGroups).toHaveLength(1)
    expect(report.personas[0].jobs.map((entry) => entry.title)).toEqual([
      highCoverage.title,
      lowCoverage.title,
    ])
  })
})
