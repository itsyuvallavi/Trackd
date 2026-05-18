import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotConfig } from '@prisma/client'
import { BOT_SEARCH_AI_EVAL_MAX_PER_RUN, BOT_SEARCH_RESULTS_WANTED } from './search-constants'
import type { SearchJobResult, SearchResponse } from './types'

const mocks = vi.hoisted(() => ({
  runSearch: vi.fn(),
  evaluateJob: vi.fn(),
  botSearchHasQueryableBackend: vi.fn(),
  jobFindMany: vi.fn(),
  jobCreate: vi.fn(),
  dismissedFindMany: vi.fn(),
  botRunLogCreateMany: vi.fn(),
  botRunListingCreateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: mocks.jobFindMany,
      create: mocks.jobCreate,
    },
    dismissedJobImport: {
      findMany: mocks.dismissedFindMany,
    },
    botRunLog: {
      createMany: mocks.botRunLogCreateMany,
    },
    botRunListing: {
      createMany: mocks.botRunListingCreateMany,
    },
  },
}))

vi.mock('./adapters/search-client', () => ({
  runSearch: mocks.runSearch,
}))

vi.mock('./job-evaluator', () => ({
  evaluateJob: mocks.evaluateJob,
}))

vi.mock('./bot-search-sources', () => ({
  botSearchHasQueryableBackend: mocks.botSearchHasQueryableBackend,
}))

function config(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg_1',
    userId: 'user_1',
    keywords: ['Frontend Engineer'],
    locations: ['Remote Europe'],
    excludeCompanies: ['Blocked Co'],
    excludeKeywords: ['PHP'],
    spokenLanguages: ['en'],
    remoteOnly: true,
    experienceLevel: 'senior_level',
    salaryMin: null,
    searchFrequency: 'DAILY',
    isActive: true,
    lastSearchAt: null,
    telegramChatId: null,
    minScore: 80,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function job(partial: Partial<SearchJobResult>): SearchJobResult {
  return {
    title: partial.title ?? 'Frontend Engineer',
    company: partial.company ?? 'Acme',
    location: partial.location ?? 'Remote',
    url: partial.url ?? 'https://example.com/job',
    description: partial.description ?? 'React TypeScript role.',
    source: partial.source ?? 'jobs_search_api',
    is_remote: partial.is_remote ?? true,
    jobBoard: partial.jobBoard,
    providerPass: partial.providerPass,
  }
}

function searchResponse(jobs: SearchJobResult[]): SearchResponse {
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

describe('runBotSearch orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    mocks.botSearchHasQueryableBackend.mockReturnValue(true)
    mocks.dismissedFindMany.mockResolvedValue([])
    mocks.jobCreate.mockResolvedValue({ id: 'job_saved' })
    mocks.botRunLogCreateMany.mockResolvedValue({ count: 0 })
    mocks.botRunListingCreateMany.mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('dedupes existing listings, evaluates new listings, and saves only approved matches', async () => {
    const existingUrl = job({
      title: 'Existing URL Role',
      company: 'Acme',
      url: 'https://example.com/existing/',
    })
    const existingTitle = job({
      title: 'Existing Title Role',
      company: 'AlreadyTracked',
      url: 'https://example.com/existing-title',
    })
    const lowScore = job({
      title: 'Batch Duplicate Role',
      company: 'DupeCo',
      url: 'https://example.com/dupe-1',
    })
    const batchDuplicate = job({
      title: 'Batch Duplicate Role',
      company: 'DupeCo',
      url: 'https://example.com/dupe-2',
    })
    const approved = job({
      title: 'Approved Role',
      company: 'GoodCo',
      url: 'https://example.com/approved',
    })

    mocks.runSearch.mockResolvedValue(
      searchResponse([existingUrl, existingTitle, lowScore, batchDuplicate, approved]),
    )
    mocks.jobFindMany.mockImplementation((args: { where: Record<string, unknown> }) => {
      if ('url' in args.where) {
        return Promise.resolve([{ url: 'https://example.com/existing', status: 'SAVED' }])
      }
      return Promise.resolve([{ company: 'AlreadyTracked', title: 'Existing Title Role' }])
    })
    mocks.evaluateJob.mockImplementation((candidate: SearchJobResult) => {
      if (candidate.title === 'Batch Duplicate Role') {
        return Promise.resolve({
          evaluation: {
            score: 60,
            shouldApply: false,
            reasoning: 'Below configured threshold.',
            flags: ['below_threshold'],
          },
          scoringInputs: { source: 'test' },
        })
      }

      return Promise.resolve({
        evaluation: {
          score: 92,
          shouldApply: true,
          reasoning: 'Strong match.',
          flags: ['good_match'],
          resumeMatch: 'React experience',
        },
        scoringInputs: { source: 'test' },
      })
    })

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1')

    expect(mocks.runSearch).toHaveBeenCalledWith({
      keywords: ['Frontend Engineer'],
      locations: ['Remote Europe'],
      remote_only: true,
      exclude_companies: ['Blocked Co'],
      exclude_keywords: ['PHP'],
      results_wanted: BOT_SEARCH_RESULTS_WANTED,
      experience_level: 'senior_level',
    })
    expect(mocks.evaluateJob).toHaveBeenCalledTimes(2)
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1)
    expect(mocks.jobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user_1',
          title: 'Approved Role',
          company: 'GoodCo',
          url: 'https://example.com/approved',
          botScore: 92,
          tags: expect.arrayContaining(['bot-approved', 'remote']),
        }),
      }),
    )
    expect(result).toMatchObject({
      jobsFound: 5,
      jobsNew: 1,
      jobsEvaluated: 2,
      jobsApproved: 1,
      jobsSkippedLowScore: 1,
      skippedExistingByUrl: 1,
      skippedExistingByTitle: 1,
      skippedBatchDuplicate: 1,
      skippedPreviouslyDismissed: 0,
    })
  })

  it('does not count approved jobs that fail to save into the queue', async () => {
    const approved = job({
      title: 'Approved But Unsaved Role',
      company: 'WriteFailCo',
      url: 'https://example.com/write-fail',
    })

    mocks.runSearch.mockResolvedValue(searchResponse([approved]))
    mocks.jobFindMany.mockResolvedValue([])
    mocks.evaluateJob.mockResolvedValue({
      evaluation: {
        score: 91,
        shouldApply: true,
        reasoning: 'Strong match.',
        flags: ['good_match'],
      },
      scoringInputs: { source: 'test' },
    })
    mocks.jobCreate.mockRejectedValue(new Error('database write failed'))

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1')

    expect(mocks.evaluateJob).toHaveBeenCalledTimes(1)
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      jobsFound: 1,
      jobsNew: 0,
      jobsEvaluated: 1,
      jobsApproved: 0,
      jobsSaveFailed: 1,
      jobsSkippedLowScore: 0,
      fatalError: 'One or more matched listings could not be saved to your tracker.',
    })
    expect(result.errors).toEqual({
      'save_Approved But Unsaved Role': 'database write failed',
    })
  })

  it('treats all-provider search failure as fatal instead of a clean zero-result run', async () => {
    mocks.runSearch.mockResolvedValue({
      jobs: [],
      meta: {
        platforms_succeeded: [],
        platforms_failed: { jobs_search_api_loc_1_term_1: 'request timed out' },
        fallback_used: false,
        total_raw: 0,
        total_deduped: 0,
        by_source_raw: {},
        by_source_deduped: {},
      },
    })

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1')

    expect(result).toMatchObject({
      jobsFound: 0,
      jobsNew: 0,
      fatalError: 'All configured search providers failed: request timed out',
      errors: {
        search: 'All configured search providers failed: request timed out',
      },
    })
    expect(mocks.jobFindMany).not.toHaveBeenCalled()
    expect(mocks.evaluateJob).not.toHaveBeenCalled()
    expect(mocks.jobCreate).not.toHaveBeenCalled()
  })

  it('treats thrown search-client errors as fatal', async () => {
    mocks.runSearch.mockRejectedValue(new Error('provider request timed out'))

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1')

    expect(result).toMatchObject({
      jobsFound: 0,
      jobsNew: 0,
      fatalError: 'provider request timed out',
      errors: {
        search: 'provider request timed out',
      },
    })
    expect(mocks.jobFindMany).not.toHaveBeenCalled()
    expect(mocks.evaluateJob).not.toHaveBeenCalled()
    expect(mocks.jobCreate).not.toHaveBeenCalled()
  })

  it('separates deterministic hard filters from AI-scored low matches', async () => {
    const wrongLocation = job({
      title: 'Frontend Developer',
      company: 'OffRegionCo',
      location: 'Pune, India',
      url: 'https://example.com/off-region',
      providerPass: {
        provider: 'jobs_search_api',
        passIndex: 0,
        searchTerm: 'Frontend Developer',
        providerQuery: 'Frontend Developer remote Europe',
        location: 'Remote',
        termIndex: 0,
        locationIndex: 0,
        isRemote: false,
        siteNames: ['linkedin', 'glassdoor'],
        resultsWanted: 5,
      },
      jobBoard: 'linkedin',
    })

    mocks.runSearch.mockResolvedValue(searchResponse([wrongLocation]))
    mocks.jobFindMany.mockResolvedValue([])
    mocks.evaluateJob.mockResolvedValue({
      evaluation: {
        score: 20,
        shouldApply: false,
        reasoning: 'Job location "Pune, India" is not in your Target locations.',
        flags: ['wrong_location'],
      },
      scoringInputs: { model: 'pre-filter' },
    })

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1')

    expect(result).toMatchObject({
      jobsFound: 1,
      jobsNew: 0,
      jobsEvaluated: 0,
      jobsHardFiltered: 1,
      jobsSkippedLowScore: 1,
    })
    expect(result.evaluationSkips[0]).toMatchObject({
      filterKind: 'hard_filter',
      jobBoard: 'linkedin',
      providerPass: expect.objectContaining({
        providerQuery: 'Frontend Developer remote Europe',
      }),
    })
    expect(mocks.jobCreate).not.toHaveBeenCalled()
  })

  it('audits AI budgeted listings without evaluating or saving them', async () => {
    const approvedJobs = Array.from({ length: BOT_SEARCH_AI_EVAL_MAX_PER_RUN }, (_, index) =>
      job({
        title: `Approved Role ${index + 1}`,
        company: `GoodCo ${index + 1}`,
        url: `https://example.com/approved-budget-${index + 1}`,
      }),
    )
    const budgeted = job({
      title: 'Budgeted Role',
      company: 'LaterCo',
      url: 'https://example.com/budgeted',
    })

    mocks.runSearch.mockResolvedValue(searchResponse([...approvedJobs, budgeted]))
    mocks.jobFindMany.mockResolvedValue([])
    mocks.evaluateJob.mockResolvedValue({
      evaluation: {
        score: 92,
        shouldApply: true,
        reasoning: 'Strong match.',
        flags: ['good_match'],
      },
      scoringInputs: { source: 'test' },
    })

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1', { botRunId: 'run_1' })

    expect(mocks.evaluateJob).toHaveBeenCalledTimes(BOT_SEARCH_AI_EVAL_MAX_PER_RUN)
    expect(mocks.evaluateJob).not.toHaveBeenCalledWith(budgeted, expect.any(Object))
    expect(mocks.jobCreate).toHaveBeenCalledTimes(BOT_SEARCH_AI_EVAL_MAX_PER_RUN)
    expect(result).toMatchObject({
      jobsFound: BOT_SEARCH_AI_EVAL_MAX_PER_RUN + 1,
      jobsNew: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
      jobsEvaluated: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
      jobsApproved: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
      jobsEvaluationFailed: 0,
      jobsSkippedLowScore: 1,
    })
    expect(result.errors.evaluation_budget).toContain('1 left unscored and not saved')
    expect(result.evaluationSkips.filter((skip) => skip.filterKind === 'eval_budget')).toHaveLength(1)

    expect(mocks.botRunListingCreateMany).toHaveBeenCalledTimes(1)
    const auditRows = mocks.botRunListingCreateMany.mock.calls[0][0].data
    expect(auditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          botRunId: 'run_1',
          sequence: 0,
          title: 'Approved Role 1',
          stage: 'saved',
          outcome: 'accepted',
          evaluated: true,
          shouldApply: true,
        }),
        expect.objectContaining({
          botRunId: 'run_1',
          sequence: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
          title: 'Budgeted Role',
          stage: 'eval_budget',
          outcome: 'rejected',
          evaluated: false,
          score: null,
          shouldApply: false,
          flags: ['eval_budget'],
          decisionReason: expect.stringContaining('not saved'),
        }),
      ]),
    )
  })

  it('prioritizes high-signal listings before spending the AI evaluation budget', async () => {
    const lowSignalJobs = Array.from({ length: BOT_SEARCH_AI_EVAL_MAX_PER_RUN }, (_, index) =>
      job({
        title: `Generic Web Role ${index + 1}`,
        company: `LowSignalCo ${index + 1}`,
        location: 'Remote',
        url: `https://example.com/low-signal-${index + 1}`,
        description: 'Short role.',
      }),
    )
    const strongLateJob = job({
      title: 'Frontend Engineer',
      company: 'StrongLateCo',
      location: 'Remote Europe',
      url: 'https://example.com/strong-late',
      description:
        'Frontend Engineer role building React and TypeScript interfaces for a remote-first Europe product team. The role includes component systems, Next.js, and production UI delivery.',
      salary_min: 90000,
      jobBoard: 'linkedin',
    })

    mocks.runSearch.mockResolvedValue(searchResponse([...lowSignalJobs, strongLateJob]))
    mocks.jobFindMany.mockResolvedValue([])
    mocks.evaluateJob.mockImplementation((candidate: SearchJobResult) =>
      Promise.resolve({
        evaluation: {
          score: candidate.company === 'StrongLateCo' ? 92 : 50,
          shouldApply: candidate.company === 'StrongLateCo',
          reasoning: candidate.company === 'StrongLateCo' ? 'Strong React match.' : 'Weak title match.',
          flags: candidate.company === 'StrongLateCo' ? ['good_match'] : ['stack_mismatch'],
        },
        scoringInputs: { source: 'test' },
      }),
    )

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1', { botRunId: 'run_1' })

    expect(mocks.evaluateJob).toHaveBeenCalledTimes(BOT_SEARCH_AI_EVAL_MAX_PER_RUN)
    expect(mocks.evaluateJob).toHaveBeenCalledWith(strongLateJob, expect.any(Object))
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1)
    expect(mocks.jobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Frontend Engineer',
          company: 'StrongLateCo',
        }),
      }),
    )
    expect(result).toMatchObject({
      jobsFound: BOT_SEARCH_AI_EVAL_MAX_PER_RUN + 1,
      jobsNew: 1,
      jobsEvaluated: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
      jobsApproved: 1,
      jobsSkippedLowScore: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
    })
    expect(result.evaluationSkips.filter((skip) => skip.filterKind === 'eval_budget')).toHaveLength(1)
    expect(result.evaluationSkips.some((skip) => skip.company === 'StrongLateCo')).toBe(false)

    const auditRows = mocks.botRunListingCreateMany.mock.calls[0][0].data
    expect(auditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sequence: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
          title: 'Frontend Engineer',
          stage: 'saved',
          outcome: 'accepted',
        }),
        expect.objectContaining({
          title: 'Generic Web Role 12',
          stage: 'eval_budget',
          scoringInputs: expect.objectContaining({
            priorityReasons: expect.arrayContaining(['description:thin']),
          }),
        }),
      ]),
    )
  })

  it('hard-filters bad listings before the AI budget so later valid listings can be scored', async () => {
    const wrongLocationJobs = Array.from({ length: BOT_SEARCH_AI_EVAL_MAX_PER_RUN }, (_, index) =>
      job({
        title: `Frontend Engineer ${index + 1}`,
        company: `OffRegionCo ${index + 1}`,
        location: 'Bengaluru, Karnataka, India',
        url: `https://example.com/off-region-${index + 1}`,
        description: 'React TypeScript role.',
        is_remote: false,
      }),
    )
    const validLateJob = job({
      title: 'Frontend Engineer',
      company: 'ValidLateCo',
      location: 'Remote Europe',
      url: 'https://example.com/valid-late',
      description:
        'Remote frontend engineering role for a Europe product team using React, TypeScript, and Next.js.',
      is_remote: true,
    })

    mocks.runSearch.mockResolvedValue(searchResponse([...wrongLocationJobs, validLateJob]))
    mocks.jobFindMany.mockResolvedValue([])
    mocks.evaluateJob.mockResolvedValue({
      evaluation: {
        score: 90,
        shouldApply: true,
        reasoning: 'Strong match.',
        flags: ['good_match'],
      },
      scoringInputs: { source: 'test' },
    })

    const { runBotSearch } = await import('./search-orchestrator')
    const result = await runBotSearch(config(), 'user_1', { botRunId: 'run_1' })

    expect(mocks.evaluateJob).toHaveBeenCalledTimes(1)
    expect(mocks.evaluateJob).toHaveBeenCalledWith(validLateJob, expect.any(Object))
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      jobsFound: BOT_SEARCH_AI_EVAL_MAX_PER_RUN + 1,
      jobsNew: 1,
      jobsEvaluated: 1,
      jobsApproved: 1,
      jobsHardFiltered: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
      jobsSkippedLowScore: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
    })
    expect(result.errors.evaluation_budget).toBeUndefined()

    const auditRows = mocks.botRunListingCreateMany.mock.calls[0][0].data
    expect(auditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sequence: 0,
          stage: 'hard_filter',
          flags: ['wrong_location'],
          scoringInputs: expect.objectContaining({
            note: expect.stringContaining('before spending an AI evaluation budget slot'),
          }),
        }),
        expect.objectContaining({
          sequence: BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
          title: 'Frontend Engineer',
          company: 'ValidLateCo',
          stage: 'saved',
        }),
      ]),
    )
  })
})
