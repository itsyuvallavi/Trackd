#!/usr/bin/env bun
/**
 * Debug script for testing email sync classification and matching
 *
 * Usage:
 *   bun run debug:sync                    # Run with sample emails
 *   bun run debug:sync --email "subject"  # Test a specific email subject
 *   bun run debug:sync --file emails.json # Test emails from a JSON file
 *   bun run debug:sync --live             # Test against live database (requires auth)
 */

import { EmailClassifier, EmailType } from '../lib/email-classifier'
import {
  EmailSyncLogger,
  createTestEmail,
  createTestJob,
  SyncPhase,
} from '../lib/email-sync-logger'
import { JobStatus } from '@prisma/client'

// Sample emails for testing
const SAMPLE_EMAILS = [
  // Application confirmations
  {
    subject: 'Thank you for applying to Acme Corp',
    from: 'jobs@acmecorp.com',
    body: 'We have received your application for the Senior Developer position and will review it shortly.',
  },
  {
    subject: 'Software Mind: Thanks for applying',
    from: 'careers@softwaremind.com',
    body: 'Thank you for your interest in Software Mind. Your application has been submitted successfully.',
  },
  {
    subject: 'Your application to Ramp',
    from: 'noreply@greenhouse.io',
    body: 'Thanks for applying to Ramp! Your application for Full Stack Engineer has been received.',
  },
  // Interview invites
  {
    subject: 'Interview invitation - TechCo',
    from: 'recruiting@techco.io',
    body: 'We would like to schedule an interview with you for the React Developer position. Please let us know your availability.',
  },
  {
    subject: 'Next steps in your application',
    from: 'talent@startup.com',
    body: 'Congratulations! We would like to schedule a phone screen to discuss your application further.',
  },
  // Rejections
  {
    subject: 'Update on your application',
    from: 'careers@bigcorp.com',
    body: 'Thank you for your interest in BigCorp. Unfortunately, we have decided to move forward with other candidates who more closely match our requirements.',
  },
  {
    subject: 'Thank you for interviewing with us',
    from: 'hr@company.com',
    body: 'We regret to inform you that we will not be moving forward with your application at this time. We will keep your resume on file for future opportunities.',
  },
  // Offers
  {
    subject: 'Job Offer - Senior Engineer at Dream Company',
    from: 'hr@dreamcompany.com',
    body: 'Congratulations! We are pleased to extend an offer to you for the Senior Engineer position. Please find the offer letter attached.',
  },
  // Ambiguous / edge cases
  {
    subject: 'Quick update on your status',
    from: 'noreply@ats.com',
    body: 'Just checking in to see if you are still interested in the position.',
  },
  {
    subject: 'Weekly newsletter from TechNews',
    from: 'newsletter@technews.com',
    body: 'Check out the latest tech news and job opportunities!',
  },
]

// Sample jobs for matching
const SAMPLE_JOBS = [
  createTestJob('job-1', 'Senior Developer', 'Acme Corp', 'SAVED', 'hr@acmecorp.com'),
  createTestJob('job-2', 'Full Stack Engineer', 'Ramp', 'SAVED'),
  createTestJob('job-3', 'React Developer', 'TechCo', 'APPLIED', 'recruiting@techco.io'),
  createTestJob('job-4', 'Software Engineer', 'BigCorp', 'INTERVIEW'),
  createTestJob('job-5', 'Senior Engineer', 'Dream Company', 'INTERVIEW'),
  createTestJob('job-6', 'Frontend Developer', 'MultiRole Inc', 'APPLIED'),
  createTestJob('job-7', 'Backend Developer', 'MultiRole Inc', 'APPLIED'),
]

function printDivider(char = '=', width = 70) {
  console.log(char.repeat(width))
}

function printHeader(text: string) {
  printDivider()
  console.log(text)
  printDivider()
}

function colorize(text: string, color: 'green' | 'red' | 'yellow' | 'blue' | 'cyan' | 'gray'): string {
  const colors: Record<string, string> = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    reset: '\x1b[0m',
  }
  return `${colors[color]}${text}${colors.reset}`
}

function getTypeColor(type: EmailType): 'green' | 'yellow' | 'red' | 'blue' | 'cyan' | 'gray' {
  switch (type) {
    case EmailType.APPLICATION_CONFIRMATION:
      return 'green'
    case EmailType.INTERVIEW_INVITE:
      return 'blue'
    case EmailType.REJECTION:
      return 'red'
    case EmailType.OFFER:
      return 'cyan'
    case EmailType.FOLLOW_UP:
      return 'yellow'
    case EmailType.OTHER:
      return 'gray'
    default:
      return 'gray'
  }
}

function getMatchColor(confidence: string): 'green' | 'yellow' | 'red' | 'gray' {
  switch (confidence) {
    case 'exact':
      return 'green'
    case 'fuzzy':
      return 'yellow'
    case 'ambiguous':
      return 'red'
    case 'none':
      return 'gray'
    default:
      return 'gray'
  }
}

async function runDebug(options: { emails?: typeof SAMPLE_EMAILS; jobs?: typeof SAMPLE_JOBS }) {
  const emails = options.emails || SAMPLE_EMAILS
  const jobs = options.jobs || SAMPLE_JOBS
  const classifier = new EmailClassifier()
  const logger = new EmailSyncLogger('debug-user', true)

  printHeader('EMAIL SYNC DEBUG TOOL')
  console.log(`Testing ${emails.length} emails against ${jobs.length} jobs\n`)

  // Print jobs for reference
  console.log(colorize('Available Jobs:', 'cyan'))
  jobs.forEach((job, i) => {
    console.log(`  ${i + 1}. [${job.id}] "${job.title}" at ${job.company} (${job.status})`)
  })
  console.log()

  const results: Array<{
    email: (typeof emails)[0]
    type: EmailType
    confidence: number
    extractedCompany: string | null
    extractedTitle: string | null
    matchResult: string
    matchedJob: string | null
    suggestedStatus: JobStatus | undefined
    keywords: string[]
  }> = []

  for (const emailData of emails) {
    printDivider('-')
    console.log(colorize(`Email: "${emailData.subject}"`, 'cyan'))
    console.log(colorize(`From: ${emailData.from}`, 'gray'))
    console.log()

    const email = createTestEmail(emailData.subject, emailData.from, emailData.body)
    const classified = classifier.classify(email)

    // Log classification
    console.log(`  Classification: ${colorize(classified.type, getTypeColor(classified.type))}`)
    console.log(`  Confidence: ${classified.confidence}%`)
    console.log(`  Keywords: ${classified.metadata.keywords.slice(0, 5).join(', ') || 'none'}`)

    // Log extracted info
    console.log(`  Extracted Company: ${classified.jobInfo?.company || colorize('not found', 'gray')}`)
    console.log(`  Extracted Title: ${classified.jobInfo?.title || colorize('not found', 'gray')}`)

    // Log suggested status
    if (classified.suggestedStatus) {
      console.log(`  Suggested Status: ${classified.suggestedStatus}`)
    }

    // Skip if OTHER or low confidence
    if (classified.type === EmailType.OTHER) {
      console.log(colorize('  -> SKIPPED (classified as OTHER)', 'gray'))
      results.push({
        email: emailData,
        type: classified.type,
        confidence: classified.confidence,
        extractedCompany: classified.jobInfo?.company || null,
        extractedTitle: classified.jobInfo?.title || null,
        matchResult: 'skipped',
        matchedJob: null,
        suggestedStatus: classified.suggestedStatus,
        keywords: classified.metadata.keywords,
      })
      continue
    }

    if (classified.confidence < 20) {
      console.log(colorize(`  -> SKIPPED (low confidence: ${classified.confidence}%)`, 'gray'))
      results.push({
        email: emailData,
        type: classified.type,
        confidence: classified.confidence,
        extractedCompany: classified.jobInfo?.company || null,
        extractedTitle: classified.jobInfo?.title || null,
        matchResult: 'skipped',
        matchedJob: null,
        suggestedStatus: classified.suggestedStatus,
        keywords: classified.metadata.keywords,
      })
      continue
    }

    // Match to jobs
    const matchResult = classifier.matchToJob(classified, jobs, {
      from: emailData.from,
      subject: emailData.subject,
    })

    console.log()
    console.log(`  Match Result: ${colorize(matchResult.confidence.toUpperCase(), getMatchColor(matchResult.confidence))}`)
    console.log(`  Reason: ${matchResult.reason}`)

    if (matchResult.jobId) {
      const job = jobs.find(j => j.id === matchResult.jobId)
      console.log(colorize(`  -> MATCHED to "${job?.title}" at ${job?.company}`, 'green'))
    } else if (matchResult.matchedJobs && matchResult.matchedJobs.length > 0) {
      console.log(colorize(`  -> AMBIGUOUS: ${matchResult.matchedJobs.length} candidates`, 'yellow'))
      matchResult.matchedJobs.forEach(j => {
        console.log(`     - "${j.title}" at ${j.company}`)
      })
    } else if (classified.jobInfo?.company && classified.jobInfo?.title) {
      console.log(colorize(`  -> NEW JOB DETECTED: "${classified.jobInfo.title}" at ${classified.jobInfo.company}`, 'blue'))
    } else {
      console.log(colorize('  -> NO MATCH (insufficient info)', 'red'))
    }

    results.push({
      email: emailData,
      type: classified.type,
      confidence: classified.confidence,
      extractedCompany: classified.jobInfo?.company || null,
      extractedTitle: classified.jobInfo?.title || null,
      matchResult: matchResult.confidence,
      matchedJob: matchResult.jobId,
      suggestedStatus: classified.suggestedStatus,
      keywords: classified.metadata.keywords,
    })
  }

  // Print summary
  printDivider()
  printHeader('SUMMARY')

  const skipped = results.filter(r => r.matchResult === 'skipped').length
  const exact = results.filter(r => r.matchResult === 'exact').length
  const fuzzy = results.filter(r => r.matchResult === 'fuzzy').length
  const ambiguous = results.filter(r => r.matchResult === 'ambiguous').length
  const noMatch = results.filter(r => r.matchResult === 'none').length

  console.log(`Total emails: ${results.length}`)
  console.log(`  ${colorize(`Skipped: ${skipped}`, 'gray')}`)
  console.log(`  ${colorize(`Exact matches: ${exact}`, 'green')}`)
  console.log(`  ${colorize(`Fuzzy matches: ${fuzzy}`, 'yellow')}`)
  console.log(`  ${colorize(`Ambiguous: ${ambiguous}`, 'red')}`)
  console.log(`  ${colorize(`No match: ${noMatch}`, 'gray')}`)

  console.log()
  console.log('Classification breakdown:')
  const byType = results.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
  })

  printDivider()

  return results
}

// Parse CLI arguments
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Email Sync Debug Tool

Usage:
  bun run debug:sync                    Run with sample emails
  bun run debug:sync --help             Show this help message

This tool helps debug issues with email classification and job matching.
It runs sample emails through the classifier and shows detailed output
for each step of the process.
`)
  process.exit(0)
}

// Run the debug
runDebug({}).catch(console.error)
