#!/usr/bin/env bun
/**
 * Test AI Job Matcher & Safety Rules
 *
 * This script exercises the AIJobMatcher in a set of controlled scenarios
 * so you can see exactly how it behaves (and verify the new safety logic).
 *
 * Usage:
 *   bun run src/scripts/test-ai-matcher.ts
 *
 * NOTE: This script will call the AI model when fuzzy / semantic matching
 * is needed. It does NOT touch the database.
 */

import { AIJobMatcher } from '../lib/ai-job-matcher'
import { ClassifiedEmail, EmailType } from '../lib/ai-email-classifier'

type MatchConfidence = 'exact' | 'fuzzy' | 'ambiguous' | 'none'

interface TestJob {
  id: string
  title: string
  company: string
  location?: string | null
  contactEmail?: string | null
}

interface TestScenario {
  name: string
  description: string
  classified: ClassifiedEmail
  jobs: TestJob[]
  expected: {
    confidence: MatchConfidence
    notes?: string
  }
}

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`
}

function color(text: string, colorCode: number): string {
  return `\x1b[${colorCode}m${text}\x1b[0m`
}

function colorConfidence(conf: MatchConfidence): string {
  switch (conf) {
    case 'exact':
      return color(conf.toUpperCase(), 32) // green
    case 'fuzzy':
      return color(conf.toUpperCase(), 33) // yellow
    case 'ambiguous':
      return color(conf.toUpperCase(), 31) // red
    case 'none':
    default:
      return color(conf.toUpperCase(), 90) // gray
  }
}

function divider(char = '=', width = 80) {
  console.log(char.repeat(width))
}

/**
 * Helper to create a minimal ClassifiedEmail instance for testing.
 * We only populate the fields needed by AIJobMatcher.
 */
function makeClassifiedEmail(params: {
  type: EmailType
  company?: string | null
  title?: string | null
  location?: string | null
  confidence?: number
}): ClassifiedEmail {
  const { type, company = null, title = null, location = null, confidence = 95 } = params

  return {
    type,
    confidence,
    jobInfo: {
      company: company ?? undefined,
      title: title ?? undefined,
      location: location ?? undefined,
    },
    suggestedStatus: undefined,
    metadata: {
      keywords: [],
      reasoning: 'Test scenario',
      shouldProcess: true,
      extractedEntities: {
        company,
        title,
        location,
        interviewDate: null,
        interviewTime: null,
        nextSteps: [],
        contactName: null,
        contactEmail: null,
        salary: null,
        rejectionReason: null,
      },
    },
  }
}

/**
 * Build the fixed set of scenarios we want to test.
 *
 * These are designed to specifically stress the new safety rules:
 * - exact single match
 * - multiple identical jobs (should become ambiguous)
 * - similar titles at same company
 * - similar titles at different companies
 * - missing job info
 */
function buildScenarios(): TestScenario[] {
  const baseJobs: TestJob[] = [
    {
      id: 'job-1',
      title: 'Frontend Developer',
      company: 'Randstad Portugal',
      location: 'Lisboa, PT',
    },
    {
      id: 'job-2',
      title: 'Frontend Developer',
      company: 'Randstad Portugal',
      location: 'Lisboa, PT',
    },
    {
      id: 'job-3',
      title: 'Fullstack Developer',
      company: 'Randstad Portugal',
      location: 'Lisboa, PT',
    },
    {
      id: 'job-4',
      title: 'Frontend Developer',
      company: 'Other Company',
      location: 'Remote',
    },
  ]

  const scenarios: TestScenario[] = [
    {
      name: 'Single Exact Match (different company)',
      description:
        'One job at Suvoda; email refers to Suvoda Frontend Developer. Should be an EXACT match without ambiguity.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Suvoda',
        title: 'Frontend Developer',
      }),
      jobs: [
        {
          id: 'suvoda-1',
          title: 'Frontend Developer',
          company: 'Suvoda',
          location: 'Remote',
        },
        ...baseJobs,
      ],
      expected: {
        confidence: 'exact',
        notes: 'Should be resolved by pre-AI exact-match logic.',
      },
    },
    {
      name: 'Duplicate Randstad Frontend Jobs (your case)',
      description:
        'Two identical Randstad Portugal Frontend Developer jobs. Email refers to Randstad Portugal Frontend Developer. Should be AMBIGUOUS and not auto-update.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Randstad Portugal',
        title: 'Frontend Developer',
      }),
      jobs: baseJobs,
      expected: {
        confidence: 'ambiguous',
        notes: 'Should be caught by pre-AI duplicate (company+title) safety check.',
      },
    },
    {
      name: 'Similar Title Same Company (Fullstack vs Frontend)',
      description:
        'Email says Randstad Portugal Fullstack Developer; jobs contain both Frontend and Fullstack at same company.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Randstad Portugal',
        title: 'Fullstack Developer',
      }),
      jobs: baseJobs,
      expected: {
        confidence: 'exact',
        notes: 'Should match the single Fullstack Developer role at Randstad.',
      },
    },
    {
      name: 'Similar Titles Different Companies',
      description:
        'Email says Frontend Developer at Other Company. Should prefer the job at Other Company over Randstad ones.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Other Company',
        title: 'Frontend Developer',
      }),
      jobs: baseJobs,
      expected: {
        confidence: 'exact',
        notes: 'Company name should disambiguate even though titles are the same.',
      },
    },
    {
      name: 'Missing Job Info',
      description:
        'Classified email does not have company or title extracted. Matcher should return NONE (no match).',
      classified: {
        type: EmailType.REJECTION,
        confidence: 90,
        jobInfo: undefined,
        suggestedStatus: undefined,
        metadata: {
          keywords: [],
          reasoning: 'Test scenario with missing jobInfo',
          shouldProcess: true,
        },
      },
      jobs: baseJobs,
      expected: {
        confidence: 'none',
        notes: 'Guard clause for missing jobInfo should trigger.',
      },
    },
    {
      name: 'Case Insensitive Company and Title',
      description:
        'Email uses lowercase company/title, jobs use mixed case. Normalization should still produce an EXACT match.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'randstad portugal',
        title: 'frontend developer',
      }),
      jobs: [
        {
          id: 'job-5',
          title: 'Frontend Developer',
          company: 'Randstad Portugal',
          location: 'Lisboa, PT',
        },
      ],
      expected: {
        confidence: 'exact',
        notes: 'Normalization should ignore case differences.',
      },
    },
    {
      name: 'Company Name With Punctuation',
      description:
        'Email mentions "Randstad Portugal, S.A." while job is "Randstad Portugal". Normalization should strip punctuation and match.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Randstad Portugal, S.A.',
        title: 'Frontend Developer',
      }),
      jobs: [
        {
          id: 'job-6',
          title: 'Frontend Developer',
          company: 'Randstad Portugal',
        },
      ],
      expected: {
        confidence: 'exact',
        notes: 'Punctuation should be removed during normalization.',
      },
    },
    {
      name: 'Title With Extra Words',
      description:
        'Email says "Senior Frontend Developer (React)" while job title is "Senior Frontend Developer". Expect AI fuzzy match or exact via normalization.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Randstad Portugal',
        title: 'Senior Frontend Developer (React)',
      }),
      jobs: [
        {
          id: 'job-7',
          title: 'Senior Frontend Developer',
          company: 'Randstad Portugal',
        },
      ],
      expected: {
        confidence: 'fuzzy',
        notes: 'AI may treat this as fuzzy due to extra qualifier.',
      },
    },
    {
      name: 'Multiple Similar Titles Single Clear Best Match',
      description:
        'Jobs include Frontend, Front-end, and Fullstack; email says "Front End Developer". Expect fuzzy match to best Frontend variant.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Tech Corp',
        title: 'Front End Developer',
      }),
      jobs: [
        {
          id: 'job-8',
          title: 'Frontend Developer',
          company: 'Tech Corp',
        },
        {
          id: 'job-9',
          title: 'Front-end Developer',
          company: 'Tech Corp',
        },
        {
          id: 'job-10',
          title: 'Fullstack Developer',
          company: 'Tech Corp',
        },
      ],
      expected: {
        confidence: 'fuzzy',
        notes: 'AI should pick one of the frontend variants with fuzzy confidence.',
      },
    },
    {
      name: 'Different Locations Same Company and Title',
      description:
        'Two identical titles and company but different locations (Lisbon vs Remote). Email omits location, so this should be AMBIGUOUS.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Acme Inc',
        title: 'Backend Engineer',
      }),
      jobs: [
        {
          id: 'job-11',
          title: 'Backend Engineer',
          company: 'Acme Inc',
          location: 'Lisbon',
        },
        {
          id: 'job-12',
          title: 'Backend Engineer',
          company: 'Acme Inc',
          location: 'Remote',
        },
      ],
      expected: {
        confidence: 'ambiguous',
        notes: 'Pre-AI duplicate (company+title) safety should trigger regardless of location.',
      },
    },
    {
      name: 'Different Locations With Location In Email',
      description:
        'Two identical titles and company but different locations; email includes "Lisbon" so AI should pick the Lisbon job.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Acme Inc',
        title: 'Backend Engineer',
        location: 'Lisbon',
      }),
      jobs: [
        {
          id: 'job-13',
          title: 'Backend Engineer',
          company: 'Acme Inc',
          location: 'Lisbon',
        },
        {
          id: 'job-14',
          title: 'Backend Engineer',
          company: 'Acme Inc',
          location: 'Remote',
        },
      ],
      expected: {
        confidence: 'fuzzy',
        notes: 'Location should help AI disambiguate to the Lisbon job.',
      },
    },
    {
      name: 'Other Company With Very Similar Name',
      description:
        'Jobs at "Randstad" and "Randstad Portugal". Email says "Randstad Portugal". Expect EXACT match to the longer company name.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Randstad Portugal',
        title: 'Frontend Developer',
      }),
      jobs: [
        {
          id: 'job-15',
          title: 'Frontend Developer',
          company: 'Randstad',
        },
        {
          id: 'job-16',
          title: 'Frontend Developer',
          company: 'Randstad Portugal',
        },
      ],
      expected: {
        confidence: 'exact',
        notes: 'AI should favor the more specific company name.',
      },
    },
    {
      name: 'Newsletter-Like Email With Jobish Subject',
      description:
        'Email looks job-related by subject but is actually a generic newsletter; classification already decided to process, but matcher sees no matching company in jobs.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Random Job Board',
        title: 'Frontend Developer',
      }),
      jobs: [
        {
          id: 'job-17',
          title: 'Frontend Developer',
          company: 'Some Startup',
        },
      ],
      expected: {
        confidence: 'none',
        notes: 'Company mismatch should lead to no confident match.',
      },
    },
    {
      name: 'Only Company Extracted (no title)',
      description:
        'Email extraction found company only. Matcher should rely on company and likely return NONE or AMBIGUOUS depending on job list.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Randstad Portugal',
        title: null,
      }),
      jobs: baseJobs,
      expected: {
        confidence: 'none',
        notes: 'Guard for missing title in jobInfo should keep this conservative.',
      },
    },
    {
      name: 'Only Title Extracted (no company)',
      description:
        'Email extraction found title only. Multiple companies have "Frontend Developer", so this should be NONE or AMBIGUOUS.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: null,
        title: 'Frontend Developer',
      }),
      jobs: baseJobs,
      expected: {
        confidence: 'none',
        notes: 'Without company, we avoid auto-updating when multiple jobs share the title.',
      },
    },
    {
      name: 'Completely Unrelated Company and Title',
      description:
        'Email references a company and title that do not exist in the jobs list. Matcher should return NONE.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'Nonexistent Corp',
        title: 'Chief Happiness Officer',
      }),
      jobs: baseJobs,
      expected: {
        confidence: 'none',
        notes: 'No overlap; AI should not invent a match.',
      },
    },
    {
      name: 'Similar Title At Multiple Companies With One Stronger Signal',
      description:
        'Two companies share similar titles, but only one shares most words. Should be a FUZZY match to the closer one.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'FutureTech',
        title: 'Senior React Frontend Engineer',
      }),
      jobs: [
        {
          id: 'job-18',
          title: 'React Frontend Engineer',
          company: 'FutureTech',
        },
        {
          id: 'job-19',
          title: 'Frontend Engineer',
          company: 'LegacySoft',
        },
      ],
      expected: {
        confidence: 'fuzzy',
        notes: 'More words in common with FutureTech job should tip the match.',
      },
    },
    {
      name: 'Archived Job Should Still Be Matchable',
      description:
        'Even if a job is archived in the real system, matching logic here should still consider it by company/title (this script does not include status, but checks the semantics).',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'OldCorp',
        title: 'Frontend Engineer',
      }),
      jobs: [
        {
          id: 'job-20',
          title: 'Frontend Engineer',
          company: 'OldCorp',
        },
      ],
      expected: {
        confidence: 'exact',
        notes: 'Demonstrates that matching is independent of status in this script.',
      },
    },
    {
      name: 'Long Noisy Title Still Matching Core Role',
      description:
        'Email title: "Senior Frontend / Fullstack Engineer (Node, React, Remote)"; job title: "Senior Fullstack Engineer". Expect FUZZY match rather than NONE.',
      classified: makeClassifiedEmail({
        type: EmailType.REJECTION,
        company: 'MegaCorp',
        title: 'Senior Frontend / Fullstack Engineer (Node, React, Remote)',
      }),
      jobs: [
        {
          id: 'job-21',
          title: 'Senior Fullstack Engineer',
          company: 'MegaCorp',
        },
      ],
      expected: {
        confidence: 'fuzzy',
        notes: 'Title normalization + AI should still connect these.',
      },
    },
  ]

  return scenarios
}

async function runScenario(
  matcher: AIJobMatcher,
  scenario: TestScenario
): Promise<void> {
  divider('-')
  console.log(bold(`Scenario: ${scenario.name}`))
  console.log(scenario.description)
  console.log()
  console.log(`Expected: ${colorConfidence(scenario.expected.confidence)}${scenario.expected.notes ? ` (${scenario.expected.notes})` : ''}`)

  console.log('\nJobs:')
  scenario.jobs.forEach((job) => {
    console.log(
      `  - [${job.id}] "${job.title}" at ${job.company}` +
        (job.location ? ` (${job.location})` : '')
    )
  })

  const emailSummary = `${scenario.classified.type} email about "${scenario.classified.jobInfo?.title ?? 'N/A'}" at "${scenario.classified.jobInfo?.company ?? 'N/A'}"`
  console.log(`\nClassified Email: ${emailSummary}`)

  try {
    const start = Date.now()
    const result = await matcher.matchToJob(scenario.classified, scenario.jobs, {
      from: 'test@example.com',
      subject: scenario.name,
    })
    const duration = Date.now() - start

    console.log('\nResult:')
    console.log(`  Confidence: ${colorConfidence(result.confidence)} (${result.confidence})`)
    console.log(`  Reason: ${result.reason}`)
    if (result.jobId) {
      const job = scenario.jobs.find((j) => j.id === result.jobId)
      if (job) {
        console.log(`  Matched Job: [${job.id}] "${job.title}" at ${job.company}`)
      } else {
        console.log(`  Matched Job: ${result.jobId} (not found in job list)`)
      }
    }
    if (result.matchedJobs && result.matchedJobs.length > 0) {
      console.log('  Candidate Jobs:')
      result.matchedJobs.forEach((job) => {
        console.log(`    - [${job.id}] "${job.title}" at ${job.company}`)
      })
    }
    console.log(`  Duration: ${duration}ms`)
  } catch (error) {
    console.error('\n❌ Error running scenario:', error)
  }
}

async function main() {
  divider()
  console.log(bold('🧪 AI Job Matcher Safety Test'))
  divider()
  console.log('This script exercises AIJobMatcher with several hand-crafted scenarios.')
  console.log('It does NOT touch the database or real emails.\n')

  const matcher = new AIJobMatcher()
  const scenarios = buildScenarios()

  for (const scenario of scenarios) {
    // eslint-disable-next-line no-await-in-loop
    await runScenario(matcher, scenario)
    console.log()
  }

  divider()
  console.log('Done. Review the output above to confirm the matcher behavior matches expectations.')
}

// Run tests (the user will decide when to execute this script)
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()


