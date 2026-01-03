#!/usr/bin/env bun
/**
 * Live Integration Test for Email Sync
 *
 * This script tests the email sync system against real data:
 * - Connects to the actual database
 * - Fetches real emails from the user's IMAP
 * - Runs classification and matching
 * - Shows detailed output of every step
 *
 * Usage:
 *   bun run src/scripts/test-email-sync-live.ts                    # Dry run (no changes)
 *   bun run src/scripts/test-email-sync-live.ts --live             # Actually update database
 *   bun run src/scripts/test-email-sync-live.ts --days 30          # Fetch last 30 days
 *   bun run src/scripts/test-email-sync-live.ts --email user@x.com # Test specific user
 */

import { prisma } from '../lib/prisma'
import { createEmailService } from '../lib/email-service'
import { EmailClassifier, EmailType, ClassifiedEmail } from '../lib/email-classifier'
import { AIClassifier } from '../lib/ai-email-classifier'
import { AIJobMatcher } from '../lib/ai-job-matcher'
import { NotificationService } from '../lib/notification-service'
import { EmailSyncLogger, SyncPhase } from '../lib/email-sync-logger'
import { JobStatus, ActivityType } from '@prisma/client'

// Feature flag: Use AI classifier if enabled
const USE_AI_CLASSIFIER = process.env.ENABLE_AI_CLASSIFICATION === 'true'

// ============================================================================
// Configuration
// ============================================================================

interface TestConfig {
  userEmail: string
  daysBack: number
  liveMode: boolean
  verbose: boolean
  limit?: number
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2)
  const config: TestConfig = {
    userEmail: 'info@yuvallavi.com',
    daysBack: 90,
    liveMode: false,
    verbose: true,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--live':
        config.liveMode = true
        break
      case '--days':
        config.daysBack = parseInt(args[++i]) || 90
        break
      case '--email':
        config.userEmail = args[++i]
        break
      case '--limit':
        config.limit = parseInt(args[++i])
        break
      case '--quiet':
        config.verbose = false
        break
      case '--help':
      case '-h':
        console.log(`
Live Email Sync Test

Usage:
  bun run src/scripts/test-email-sync-live.ts [options]

Options:
  --live          Actually update the database (default: dry run)
  --days N        Fetch emails from last N days (default: 90)
  --email EMAIL   Test specific user by email (default: info@yuvallavi.com)
  --limit N       Limit to first N emails
  --quiet         Less verbose output
  --help          Show this help

Examples:
  bun run src/scripts/test-email-sync-live.ts                    # Dry run, last 90 days
  bun run src/scripts/test-email-sync-live.ts --days 7           # Last 7 days only
  bun run src/scripts/test-email-sync-live.ts --live --days 30   # Live update, last 30 days
`)
        process.exit(0)
    }
  }

  return config
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function colorize(text: string, color: 'green' | 'red' | 'yellow' | 'blue' | 'cyan' | 'gray' | 'magenta' | 'white'): string {
  const colors: Record<string, string> = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    magenta: '\x1b[35m',
    white: '\x1b[97m',
    reset: '\x1b[0m',
  }
  return `${colors[color]}${text}${colors.reset}`
}

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`
}

function divider(char = '=', width = 80) {
  console.log(char.repeat(width))
}

function header(text: string) {
  divider()
  console.log(bold(text))
  divider()
}

function subHeader(text: string) {
  console.log('\n' + bold(colorize(text, 'cyan')))
  console.log('-'.repeat(60))
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A'
  return date.toISOString().split('T')[0]
}

function formatStatus(status: JobStatus): string {
  const colors: Record<JobStatus, 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'magenta'> = {
    SAVED: 'gray',
    APPLIED: 'blue',
    INTERVIEW: 'yellow',
    OFFER: 'green',
    REJECTED: 'red',
    GHOSTED: 'magenta',
  }
  return colorize(status, colors[status])
}

function formatEmailType(type: EmailType): string {
  const colors: Record<EmailType, 'green' | 'blue' | 'red' | 'cyan' | 'yellow' | 'gray'> = {
    APPLICATION_CONFIRMATION: 'green',
    INTERVIEW_INVITE: 'blue',
    REJECTION: 'red',
    OFFER: 'cyan',
    FOLLOW_UP: 'yellow',
    OTHER: 'gray',
  }
  return colorize(type, colors[type])
}

function formatMatchResult(confidence: string): string {
  const colors: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
    exact: 'green',
    fuzzy: 'yellow',
    ambiguous: 'red',
    none: 'gray',
  }
  return colorize(confidence.toUpperCase(), colors[confidence] || 'gray')
}

// ============================================================================
// Main Test Flow
// ============================================================================

interface TestResult {
  email: {
    subject: string
    from: string
    date: Date
  }
  classification: {
    type: EmailType
    confidence: number
    keywords: string[]
    suggestedStatus?: JobStatus
  }
  extraction: {
    company: string | null
    title: string | null
    location: string | null
  }
  matching: {
    result: 'exact' | 'fuzzy' | 'ambiguous' | 'none'
    reason: string
    matchedJob?: {
      id: string
      title: string
      company: string
      currentStatus: JobStatus
    }
    candidateJobs?: Array<{ id: string; title: string; company: string }>
  }
  action: 'skipped' | 'updated' | 'ambiguous' | 'new_job' | 'no_match'
  actionDetails?: string
}

async function runLiveTest(config: TestConfig) {
  console.log('\n')
  header('🧪 LIVE EMAIL SYNC INTEGRATION TEST')
  console.log(`User: ${colorize(config.userEmail, 'cyan')}`)
  console.log(`Days: ${config.daysBack}`)
  console.log(`Mode: ${config.liveMode ? colorize('LIVE (will update database)', 'red') : colorize('DRY RUN (no changes)', 'green')}`)
  if (config.limit) console.log(`Limit: ${config.limit} emails`)
  console.log()

  // -------------------------------------------------------------------------
  // Step 1: Fetch User Profile
  // -------------------------------------------------------------------------
  subHeader('📋 Step 1: Fetching User Profile')

  const profile = await prisma.profile.findUnique({
    where: { email: config.userEmail },
  })

  if (!profile) {
    console.log(colorize(`❌ User not found: ${config.userEmail}`, 'red'))
    process.exit(1)
  }

  console.log(`Found user: ${profile.name || profile.email}`)
  console.log(`User ID: ${profile.id}`)

  // -------------------------------------------------------------------------
  // Step 2: Fetch Email Integration
  // -------------------------------------------------------------------------
  subHeader('📧 Step 2: Fetching Email Integration')

  const integration = await prisma.emailIntegration.findUnique({
    where: { userId: profile.id },
  })

  if (!integration) {
    console.log(colorize('❌ No email integration configured for this user', 'red'))
    process.exit(1)
  }

  console.log(`Provider: ${integration.provider}`)
  console.log(`Email: ${integration.email}`)
  console.log(`IMAP Host: ${integration.imapHost}`)
  console.log(`Active: ${integration.isActive}`)
  console.log(`Last Synced: ${formatDate(integration.lastSyncedAt)}`)
  if (integration.lastError) {
    console.log(colorize(`Last Error: ${integration.lastError}`, 'red'))
  }

  if (!integration.imapHost || !integration.imapPort || !integration.imapUsername || !integration.imapPassword) {
    console.log(colorize('❌ Missing IMAP configuration', 'red'))
    process.exit(1)
  }

  // -------------------------------------------------------------------------
  // Step 3: Fetch User's Jobs
  // -------------------------------------------------------------------------
  subHeader('💼 Step 3: Fetching User\'s Jobs')

  const jobs = await prisma.job.findMany({
    where: { userId: profile.id },
    select: {
      id: true,
      title: true,
      company: true,
      url: true,
      status: true,
      contactEmail: true,
      contactName: true,
      location: true,
      appliedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Found ${jobs.length} jobs:\n`)

  // Group jobs by status for display
  const jobsByStatus = jobs.reduce((acc, job) => {
    acc[job.status] = acc[job.status] || []
    acc[job.status].push(job)
    return acc
  }, {} as Record<JobStatus, typeof jobs>)

  for (const [status, statusJobs] of Object.entries(jobsByStatus)) {
    console.log(`  ${formatStatus(status as JobStatus)} (${statusJobs.length}):`)
    for (const job of statusJobs.slice(0, 5)) {
      console.log(`    - "${job.title}" at ${job.company}`)
    }
    if (statusJobs.length > 5) {
      console.log(colorize(`    ... and ${statusJobs.length - 5} more`, 'gray'))
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Fetch Emails
  // -------------------------------------------------------------------------
  subHeader('📬 Step 4: Fetching Emails from IMAP')

  const syncSince = new Date(Date.now() - config.daysBack * 24 * 60 * 60 * 1000)
  console.log(`Fetching emails since: ${syncSince.toISOString()}`)

  const emailService = createEmailService({
    host: integration.imapHost,
    port: integration.imapPort,
    user: integration.imapUsername,
    password: integration.imapPassword,
  })

  let emails
  try {
    emails = await emailService.fetchEmailsSince(syncSince)
    console.log(colorize(`✓ Fetched ${emails.length} emails`, 'green'))
  } catch (error) {
    console.log(colorize(`❌ Failed to fetch emails: ${error}`, 'red'))
    process.exit(1)
  }

  if (config.limit && emails.length > config.limit) {
    emails = emails.slice(0, config.limit)
    console.log(colorize(`  (Limited to first ${config.limit} emails)`, 'gray'))
  }

  // -------------------------------------------------------------------------
  // Step 5: Process Each Email
  // -------------------------------------------------------------------------
  subHeader('🔍 Step 5: Processing Emails')

  const USE_AI_MATCHING = process.env.ENABLE_AI_MATCHING === 'true'
  
  console.log(`Using ${USE_AI_CLASSIFIER ? colorize('AI', 'cyan') : colorize('keyword-based', 'yellow')} classifier`)
  console.log(`Using ${USE_AI_MATCHING ? colorize('AI', 'cyan') : colorize('keyword-based', 'yellow')} matcher`)
  
  const classifier = USE_AI_CLASSIFIER ? new AIClassifier() : new EmailClassifier()
  const keywordClassifier = new EmailClassifier() // Keep for matchToJob method (fallback)
  const aiMatcher = USE_AI_MATCHING ? new AIJobMatcher() : null
  const notificationService = new NotificationService()
  const logger = new EmailSyncLogger(profile.id, false)
  const results: TestResult[] = []

  const stats = {
    total: emails.length,
    skippedOther: 0,
    skippedLowConfidence: 0,
    exactMatches: 0,
    fuzzyMatches: 0,
    ambiguous: 0,
    newJobs: 0,
    noMatch: 0,
    updated: 0,
  }

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i]
    const emailNum = i + 1

    console.log(`\n${colorize(`[${emailNum}/${emails.length}]`, 'gray')} ${bold(email.subject.slice(0, 60))}${email.subject.length > 60 ? '...' : ''}`)
    console.log(`  From: ${colorize(email.from, 'gray')}`)
    console.log(`  Date: ${colorize(formatDate(email.date), 'gray')}`)

    // Classify (AI is async, keyword-based is sync)
    const classified = USE_AI_CLASSIFIER
      ? await (classifier as AIClassifier).classify(email)
      : (classifier as EmailClassifier).classify(email)

    console.log(`  Type: ${formatEmailType(classified.type)} (${classified.confidence}% confidence)`)
    
    // Show AI-specific info or keywords
    if (USE_AI_CLASSIFIER && 'reasoning' in classified.metadata) {
      const reasoning = (classified.metadata as { reasoning?: string }).reasoning
      console.log(`  Reasoning: ${colorize(reasoning || 'N/A', 'gray')}`)
      if ('shouldProcess' in classified.metadata) {
        const shouldProcess = (classified.metadata as { shouldProcess?: boolean }).shouldProcess
        console.log(`  Should Process: ${shouldProcess ? colorize('true', 'green') : colorize('false', 'red')}`)
      }
    } else if ('keywords' in classified.metadata && classified.metadata.keywords.length > 0) {
      console.log(`  Keywords: ${colorize(classified.metadata.keywords.slice(0, 3).join(', '), 'gray')}`)
    }

    // Check if AI says we should skip
    if (USE_AI_CLASSIFIER && 'shouldProcess' in classified.metadata && classified.metadata.shouldProcess === false) {
      stats.skippedOther++
      console.log(colorize('  → SKIPPED (AI determined not job-related)', 'gray'))
      results.push({
        email: { subject: email.subject, from: email.from, date: email.date },
        classification: {
          type: classified.type,
          confidence: classified.confidence,
          keywords: 'keywords' in classified.metadata ? classified.metadata.keywords : [],
        },
        extraction: { company: null, title: null, location: null },
        matching: { result: 'none', reason: 'Skipped - AI shouldProcess=false' },
        action: 'skipped',
      })
      continue
    }

    // Check if skipped
    if (classified.type === EmailType.OTHER) {
      stats.skippedOther++
      console.log(colorize('  → SKIPPED (classified as OTHER)', 'gray'))
      results.push({
        email: { subject: email.subject, from: email.from, date: email.date },
        classification: {
          type: classified.type,
          confidence: classified.confidence,
          keywords: 'keywords' in classified.metadata ? classified.metadata.keywords : [],
        },
        extraction: { company: null, title: null, location: null },
        matching: { result: 'none', reason: 'Skipped - OTHER type' },
        action: 'skipped',
      })
      continue
    }

    if (classified.confidence < 20) {
      stats.skippedLowConfidence++
      console.log(colorize(`  → SKIPPED (low confidence: ${classified.confidence}%)`, 'gray'))
      results.push({
        email: { subject: email.subject, from: email.from, date: email.date },
        classification: {
          type: classified.type,
          confidence: classified.confidence,
          keywords: classified.metadata.keywords,
        },
        extraction: { company: null, title: null, location: null },
        matching: { result: 'none', reason: 'Skipped - low confidence' },
        action: 'skipped',
      })
      continue
    }

    // Show extraction
    console.log(`  Extracted Company: ${classified.jobInfo?.company || colorize('not found', 'gray')}`)
    console.log(`  Extracted Title: ${classified.jobInfo?.title || colorize('not found', 'gray')}`)
    if (classified.suggestedStatus) {
      console.log(`  Suggested Status: ${formatStatus(classified.suggestedStatus)}`)
    }

    // Match to jobs using AI or keyword-based matching
    const matchResult = USE_AI_MATCHING && aiMatcher
      ? await aiMatcher.matchToJob(classified, jobs, {
          from: email.from,
          subject: email.subject,
        })
      : keywordClassifier.matchToJob(classified, jobs, {
          from: email.from,
          subject: email.subject,
        })

    console.log(`  Match: ${formatMatchResult(matchResult.confidence)} - ${matchResult.reason}`)

    let action: TestResult['action'] = 'no_match'
    let actionDetails: string | undefined

    if (matchResult.confidence === 'exact' || matchResult.confidence === 'fuzzy') {
      if (matchResult.confidence === 'exact') stats.exactMatches++
      else stats.fuzzyMatches++

      const matchedJob = jobs.find(j => j.id === matchResult.jobId)
      if (matchedJob && classified.suggestedStatus) {
        const shouldUpdate = shouldUpdateStatus(matchedJob.status, classified.suggestedStatus)

        if (shouldUpdate) {
          action = 'updated'
          stats.updated++
          actionDetails = `${matchedJob.status} → ${classified.suggestedStatus}`
          console.log(colorize(`  → WOULD UPDATE: "${matchedJob.title}" at ${matchedJob.company}`, 'green'))
          console.log(colorize(`    Status: ${matchedJob.status} → ${classified.suggestedStatus}`, 'green'))

          if (config.liveMode) {
            await prisma.job.update({
              where: { id: matchResult.jobId! },
              data: { status: classified.suggestedStatus },
            })
            await prisma.activity.create({
              data: {
                jobId: matchResult.jobId!,
                userId: profile.id,
                type: getActivityType(classified.type),
                fromStatus: matchedJob.status,
                toStatus: classified.suggestedStatus,
                description: `Email detected: ${email.subject}`,
              },
            })
            await notificationService.createJobUpdatedNotification(
              profile.id,
              matchResult.jobId!,
              matchedJob.title,
              matchedJob.company,
              matchedJob.status,
              classified.suggestedStatus,
              'email'
            )
            console.log(colorize('    ✓ Database updated', 'green'))
          }
        } else {
          action = 'skipped'
          actionDetails = `Status would go backwards (${matchedJob.status} vs ${classified.suggestedStatus})`
          console.log(colorize(`  → SKIPPED: Status would not advance`, 'gray'))
        }
      }

      results.push({
        email: { subject: email.subject, from: email.from, date: email.date },
        classification: {
          type: classified.type,
          confidence: classified.confidence,
          keywords: classified.metadata.keywords,
          suggestedStatus: classified.suggestedStatus,
        },
        extraction: {
          company: classified.jobInfo?.company || null,
          title: classified.jobInfo?.title || null,
          location: classified.jobInfo?.location || null,
        },
        matching: {
          result: matchResult.confidence,
          reason: matchResult.reason,
          matchedJob: matchedJob ? {
            id: matchedJob.id,
            title: matchedJob.title,
            company: matchedJob.company,
            currentStatus: matchedJob.status,
          } : undefined,
        },
        action,
        actionDetails,
      })
    } else if (matchResult.confidence === 'ambiguous') {
      stats.ambiguous++
      action = 'ambiguous'
      console.log(colorize(`  → AMBIGUOUS: ${matchResult.matchedJobs?.length} candidates`, 'yellow'))
      for (const job of matchResult.matchedJobs || []) {
        console.log(colorize(`    - "${job.title}" at ${job.company}`, 'yellow'))
      }

      if (config.liveMode) {
        await notificationService.createAmbiguousMatchNotification(
          profile.id,
          email,
          matchResult.matchedJobs || [],
          classified
        )
        console.log(colorize('    ✓ Ambiguous notification created', 'yellow'))
      }

      results.push({
        email: { subject: email.subject, from: email.from, date: email.date },
        classification: {
          type: classified.type,
          confidence: classified.confidence,
          keywords: classified.metadata.keywords,
          suggestedStatus: classified.suggestedStatus,
        },
        extraction: {
          company: classified.jobInfo?.company || null,
          title: classified.jobInfo?.title || null,
          location: classified.jobInfo?.location || null,
        },
        matching: {
          result: matchResult.confidence,
          reason: matchResult.reason,
          candidateJobs: matchResult.matchedJobs,
        },
        action,
      })
    } else {
      // No match
      if (classified.jobInfo?.company && classified.jobInfo?.title && classified.jobInfo.title !== 'Unknown Position') {
        // Check if job already exists
        const existingJob = checkForExistingJob(classified, jobs)
        if (existingJob) {
          action = 'skipped'
          actionDetails = `Job already exists: "${existingJob.title}" at ${existingJob.company}`
          console.log(colorize(`  → SKIPPED: Job already exists`, 'gray'))
        } else {
          stats.newJobs++
          action = 'new_job'
          console.log(colorize(`  → NEW JOB DETECTED: "${classified.jobInfo.title}" at ${classified.jobInfo.company}`, 'blue'))

          if (config.liveMode) {
            await notificationService.createNewJobDetectedNotification(
              profile.id,
              email,
              classified,
              {
                company: classified.jobInfo.company,
                title: classified.jobInfo.title,
                location: classified.jobInfo.location,
              }
            )
            console.log(colorize('    ✓ New job notification created', 'blue'))
          }
        }
      } else {
        stats.noMatch++
        action = 'no_match'
        console.log(colorize('  → NO MATCH: Insufficient info extracted', 'gray'))

        if (config.liveMode) {
          await notificationService.createNoMatchNotification(profile.id, email, classified)
          console.log(colorize('    ✓ No-match notification created', 'gray'))
        }
      }

      results.push({
        email: { subject: email.subject, from: email.from, date: email.date },
        classification: {
          type: classified.type,
          confidence: classified.confidence,
          keywords: classified.metadata.keywords,
          suggestedStatus: classified.suggestedStatus,
        },
        extraction: {
          company: classified.jobInfo?.company || null,
          title: classified.jobInfo?.title || null,
          location: classified.jobInfo?.location || null,
        },
        matching: {
          result: matchResult.confidence,
          reason: matchResult.reason,
        },
        action,
        actionDetails,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Summary
  // -------------------------------------------------------------------------
  subHeader('📊 Step 6: Summary')

  console.log(`Total emails processed: ${stats.total}`)
  console.log()
  console.log('Classification:')
  console.log(`  Skipped (OTHER): ${stats.skippedOther}`)
  console.log(`  Skipped (low confidence): ${stats.skippedLowConfidence}`)
  console.log()
  console.log('Matching:')
  console.log(`  ${colorize(`Exact matches: ${stats.exactMatches}`, 'green')}`)
  console.log(`  ${colorize(`Fuzzy matches: ${stats.fuzzyMatches}`, 'yellow')}`)
  console.log(`  ${colorize(`Ambiguous: ${stats.ambiguous}`, 'red')}`)
  console.log(`  ${colorize(`New jobs detected: ${stats.newJobs}`, 'blue')}`)
  console.log(`  ${colorize(`No match: ${stats.noMatch}`, 'gray')}`)
  console.log()
  console.log('Actions:')
  console.log(`  Jobs ${config.liveMode ? 'updated' : 'would be updated'}: ${stats.updated}`)

  if (config.liveMode) {
    // Update sync timestamp
    await prisma.emailIntegration.update({
      where: { userId: profile.id },
      data: {
        lastSyncedAt: new Date(),
        lastError: null,
      },
    })

    // Create sync complete notification
    await notificationService.createSyncCompleteNotification(profile.id, {
      totalEmails: stats.total,
      processedEmails: stats.total - stats.skippedOther - stats.skippedLowConfidence,
      createdJobs: 0,
      updatedJobs: stats.updated,
      skippedEmails: stats.skippedOther + stats.skippedLowConfidence,
      ambiguousMatches: stats.ambiguous,
      newJobsDetected: stats.newJobs,
      noMatches: stats.noMatch,
    })

    console.log(colorize('\n✓ Database updated and sync notification created', 'green'))
  } else {
    console.log(colorize('\n(Dry run - no changes made to database)', 'gray'))
  }

  // -------------------------------------------------------------------------
  // Step 7: Export Results
  // -------------------------------------------------------------------------
  // Step 7: Export Results
  // -------------------------------------------------------------------------
  // @ts-ignore - Bun is available at runtime
  const exportPath = `/tmp/email-sync-test-${Date.now()}.json`
  // @ts-ignore - Bun is available at runtime
  await Bun.write(exportPath, JSON.stringify({ config, stats, results }, null, 2))
  console.log(`\nDetailed results exported to: ${exportPath}`)

  divider()
  console.log('Test complete!\n')

  // Disconnect
  await prisma.$disconnect()
}

// ============================================================================
// Helper Functions
// ============================================================================

function shouldUpdateStatus(currentStatus: JobStatus, suggestedStatus: JobStatus): boolean {
  const statusHierarchy: Record<JobStatus, number> = {
    SAVED: 0,
    APPLIED: 1,
    INTERVIEW: 2,
    OFFER: 3,
    REJECTED: 99,
    GHOSTED: 99,
  }

  const currentLevel = statusHierarchy[currentStatus]
  const suggestedLevel = statusHierarchy[suggestedStatus]

  return suggestedLevel > currentLevel || suggestedStatus === JobStatus.REJECTED
}

function getActivityType(emailType: EmailType): ActivityType {
  switch (emailType) {
    case EmailType.APPLICATION_CONFIRMATION:
      return ActivityType.STATUS_CHANGE
    case EmailType.INTERVIEW_INVITE:
      return ActivityType.INTERVIEW
    case EmailType.REJECTION:
      return ActivityType.REJECTION
    case EmailType.OFFER:
      return ActivityType.OFFER
    default:
      return ActivityType.EMAIL_UPDATE
  }
}

function checkForExistingJob(
  classified: ClassifiedEmail,
  jobs: Array<{ id: string; title: string; company: string }>
): { title: string; company: string } | null {
  if (!classified.jobInfo?.title) return null

  const normalizeTitle = (title: string) => {
    return title.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  const emailTitleNormalized = normalizeTitle(classified.jobInfo.title)

  for (const job of jobs) {
    const jobTitleNormalized = normalizeTitle(job.title)

    // Exact match
    if (jobTitleNormalized === emailTitleNormalized) {
      return job
    }

    // Substring match
    if (jobTitleNormalized.includes(emailTitleNormalized) || emailTitleNormalized.includes(jobTitleNormalized)) {
      const lengthDiff = Math.abs(jobTitleNormalized.length - emailTitleNormalized.length)
      const shorterLength = Math.min(jobTitleNormalized.length, emailTitleNormalized.length)
      if (lengthDiff < shorterLength * 0.3) {
        return job
      }
    }

    // Word overlap
    const emailWords = emailTitleNormalized.split(/\s+/).filter(w => w.length > 2)
    const jobWords = jobTitleNormalized.split(/\s+/).filter(w => w.length > 2)
    const commonWords = emailWords.filter(word => jobWords.includes(word))
    const matchRatio = commonWords.length / Math.max(emailWords.length, jobWords.length)

    if (matchRatio >= 0.8) {
      return job
    }
  }

  return null
}

// ============================================================================
// Run
// ============================================================================

const config = parseArgs()
runLiveTest(config).catch((error) => {
  console.error(colorize(`\n❌ Error: ${error.message}`, 'red'))
  console.error(error.stack)
  process.exit(1)
})
