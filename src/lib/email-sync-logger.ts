/**
 * Enhanced logging for email sync process
 *
 * This logger provides detailed, structured logging to help debug
 * issues with email classification, job matching, and notifications.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface EmailSyncLogEntry {
  timestamp: string
  level: LogLevel
  phase: SyncPhase
  message: string
  details?: Record<string, unknown>
  emailId?: string
  jobId?: string
}

export enum SyncPhase {
  INIT = 'INIT',
  FETCH = 'FETCH',
  CLASSIFY = 'CLASSIFY',
  EXTRACT = 'EXTRACT',
  MATCH = 'MATCH',
  UPDATE = 'UPDATE',
  NOTIFY = 'NOTIFY',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface ClassificationLogDetails {
  emailSubject: string
  emailFrom: string
  emailDate: string
  detectedType: string
  confidence: number
  matchedKeywords: string[]
  extractedCompany: string | null
  extractedTitle: string | null
  extractedLocation: string | null
}

export interface MatchingLogDetails {
  emailSubject: string
  extractedCompany: string | null
  extractedTitle: string | null
  matchResult: 'exact' | 'fuzzy' | 'ambiguous' | 'none'
  matchReason: string
  matchedJobId: string | null
  matchedJobTitle: string | null
  matchedJobCompany: string | null
  candidateJobs?: Array<{ id: string; title: string; company: string }>
  allJobsChecked: number
}

export interface SyncSummary {
  userId: string
  startTime: string
  endTime: string
  duration: number
  totalEmails: number
  processedEmails: number
  skippedEmails: number
  skippedReasons: {
    otherType: number
    lowConfidence: number
  }
  matchResults: {
    exact: number
    fuzzy: number
    ambiguous: number
    noMatch: number
    newJobDetected: number
  }
  jobsUpdated: number
  notificationsCreated: number
  errors: Array<{ message: string; emailSubject?: string }>
}

export class EmailSyncLogger {
  private logs: EmailSyncLogEntry[] = []
  private userId: string
  private startTime: Date
  private summary: Partial<SyncSummary> = {
    skippedReasons: { otherType: 0, lowConfidence: 0 },
    matchResults: { exact: 0, fuzzy: 0, ambiguous: 0, noMatch: 0, newJobDetected: 0 },
    errors: [],
  }
  private enableConsole: boolean

  constructor(userId: string, enableConsole = true) {
    this.userId = userId
    this.startTime = new Date()
    this.enableConsole = enableConsole
    this.summary.userId = userId
    this.summary.startTime = this.startTime.toISOString()
  }

  private log(level: LogLevel, phase: SyncPhase, message: string, details?: Record<string, unknown>) {
    const entry: EmailSyncLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      phase,
      message,
      details,
    }
    this.logs.push(entry)

    if (this.enableConsole) {
      const icon = this.getIcon(level, phase)
      const prefix = `[${phase}]`
      const detailsStr = details ? ` ${JSON.stringify(details, null, 0)}` : ''
      console.log(`${icon} ${prefix} ${message}${detailsStr}`)
    }
  }

  private getIcon(level: LogLevel, phase: SyncPhase): string {
    const icons: Record<SyncPhase, string> = {
      [SyncPhase.INIT]: '🚀',
      [SyncPhase.FETCH]: '📧',
      [SyncPhase.CLASSIFY]: '🏷️',
      [SyncPhase.EXTRACT]: '🔍',
      [SyncPhase.MATCH]: '🎯',
      [SyncPhase.UPDATE]: '✏️',
      [SyncPhase.NOTIFY]: '🔔',
      [SyncPhase.COMPLETE]: '✅',
      [SyncPhase.ERROR]: '❌',
    }

    if (level === LogLevel.ERROR) return '❌'
    if (level === LogLevel.WARN) return '⚠️'
    return icons[phase] || '📝'
  }

  // Phase: Initialization
  logInit(message: string, details?: Record<string, unknown>) {
    this.log(LogLevel.INFO, SyncPhase.INIT, message, details)
  }

  // Phase: Email Fetching
  logFetch(emailCount: number, since: Date) {
    this.summary.totalEmails = emailCount
    this.log(LogLevel.INFO, SyncPhase.FETCH, `Fetched ${emailCount} emails since ${since.toISOString()}`, {
      emailCount,
      since: since.toISOString(),
    })
  }

  logFetchError(error: Error) {
    this.log(LogLevel.ERROR, SyncPhase.FETCH, `Failed to fetch emails: ${error.message}`, {
      error: error.message,
      stack: error.stack,
    })
    this.summary.errors!.push({ message: `Fetch error: ${error.message}` })
  }

  // Phase: Classification
  logClassification(details: ClassificationLogDetails) {
    const level = details.confidence < 20 ? LogLevel.DEBUG : LogLevel.INFO
    this.log(level, SyncPhase.CLASSIFY, `Classified: "${details.emailSubject.slice(0, 50)}..."`, {
      type: details.detectedType,
      confidence: details.confidence,
      keywords: details.matchedKeywords.slice(0, 5),
    })
  }

  logClassificationSkip(reason: 'other' | 'lowConfidence', emailSubject: string, details: { type: string; confidence: number }) {
    if (reason === 'other') {
      this.summary.skippedReasons!.otherType++
    } else {
      this.summary.skippedReasons!.lowConfidence++
    }
    this.log(LogLevel.DEBUG, SyncPhase.CLASSIFY, `Skipped: "${emailSubject.slice(0, 40)}..." - ${reason}`, details)
  }

  // Phase: Job Info Extraction
  logExtraction(emailSubject: string, extracted: { company?: string; title?: string; location?: string }) {
    const success = !!(extracted.company || extracted.title)
    this.log(
      success ? LogLevel.INFO : LogLevel.WARN,
      SyncPhase.EXTRACT,
      `Extracted from "${emailSubject.slice(0, 40)}...": company="${extracted.company || 'N/A'}", title="${extracted.title || 'N/A'}"`,
      extracted
    )
  }

  // Phase: Job Matching
  logMatching(details: MatchingLogDetails) {
    const level = details.matchResult === 'none' || details.matchResult === 'ambiguous'
      ? LogLevel.WARN
      : LogLevel.INFO

    // Map 'none' to 'noMatch' for the summary
    const resultKey = details.matchResult === 'none' ? 'noMatch' : details.matchResult
    if (resultKey in this.summary.matchResults!) {
      this.summary.matchResults![resultKey as keyof typeof this.summary.matchResults]++
    }

    this.log(level, SyncPhase.MATCH,
      `Match result for "${details.emailSubject.slice(0, 40)}...": ${details.matchResult}`,
      {
        result: details.matchResult,
        reason: details.matchReason,
        extractedCompany: details.extractedCompany,
        extractedTitle: details.extractedTitle,
        matchedJob: details.matchedJobId ? {
          id: details.matchedJobId,
          title: details.matchedJobTitle,
          company: details.matchedJobCompany,
        } : null,
        candidateCount: details.candidateJobs?.length,
        totalJobsChecked: details.allJobsChecked,
      }
    )
  }

  logMatchAmbiguous(emailSubject: string, candidates: Array<{ id: string; title: string; company: string }>) {
    this.log(LogLevel.WARN, SyncPhase.MATCH,
      `Ambiguous match for "${emailSubject.slice(0, 40)}...": ${candidates.length} candidates`,
      {
        candidates: candidates.map(c => ({ id: c.id, title: c.title, company: c.company })),
      }
    )
  }

  logMatchNewJobDetected(company: string, title: string, emailSubject: string) {
    this.summary.matchResults!.newJobDetected++
    this.log(LogLevel.INFO, SyncPhase.MATCH,
      `New job detected: "${title}" at ${company}`,
      { company, title, emailSubject: emailSubject.slice(0, 50) }
    )
  }

  logMatchNoMatch(emailSubject: string, reason: string, extracted: { company?: string; title?: string }) {
    this.log(LogLevel.WARN, SyncPhase.MATCH,
      `No match for "${emailSubject.slice(0, 40)}...": ${reason}`,
      { extracted, reason }
    )
  }

  logExistingJobSkipped(emailSubject: string, existingJob: { title: string; company: string }, matchType: 'title' | 'company+title') {
    this.log(LogLevel.DEBUG, SyncPhase.MATCH,
      `Skipped (already exists): "${emailSubject.slice(0, 40)}..." matches "${existingJob.title}" at ${existingJob.company}`,
      { existingJob, matchType }
    )
  }

  // Phase: Job Update
  logJobUpdate(jobId: string, jobTitle: string, company: string, oldStatus: string | null, newStatus: string) {
    this.summary.jobsUpdated = (this.summary.jobsUpdated || 0) + 1
    this.log(LogLevel.INFO, SyncPhase.UPDATE,
      `Updated job: "${jobTitle}" at ${company}: ${oldStatus || 'none'} → ${newStatus}`,
      { jobId, oldStatus, newStatus }
    )
  }

  logJobUpdateSkipped(jobId: string, jobTitle: string, reason: string) {
    this.log(LogLevel.DEBUG, SyncPhase.UPDATE,
      `Update skipped for "${jobTitle}": ${reason}`,
      { jobId, reason }
    )
  }

  // Phase: Notifications
  logNotification(type: string, details: Record<string, unknown>) {
    this.summary.notificationsCreated = (this.summary.notificationsCreated || 0) + 1
    this.log(LogLevel.INFO, SyncPhase.NOTIFY, `Created ${type} notification`, details)
  }

  // Phase: Errors
  logError(phase: SyncPhase, message: string, error?: Error, emailSubject?: string) {
    this.summary.errors!.push({ message, emailSubject })
    this.log(LogLevel.ERROR, phase, message, {
      error: error?.message,
      stack: error?.stack,
      emailSubject,
    })
  }

  // Get complete summary
  getSummary(): SyncSummary {
    const endTime = new Date()
    return {
      userId: this.userId,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - this.startTime.getTime(),
      totalEmails: this.summary.totalEmails || 0,
      processedEmails: (this.summary.matchResults!.exact || 0) +
                       (this.summary.matchResults!.fuzzy || 0) +
                       (this.summary.matchResults!.ambiguous || 0) +
                       (this.summary.matchResults!.noMatch || 0) +
                       (this.summary.matchResults!.newJobDetected || 0),
      skippedEmails: (this.summary.skippedReasons!.otherType || 0) +
                     (this.summary.skippedReasons!.lowConfidence || 0),
      skippedReasons: this.summary.skippedReasons!,
      matchResults: this.summary.matchResults!,
      jobsUpdated: this.summary.jobsUpdated || 0,
      notificationsCreated: this.summary.notificationsCreated || 0,
      errors: this.summary.errors || [],
    }
  }

  // Get all logs
  getLogs(): EmailSyncLogEntry[] {
    return [...this.logs]
  }

  // Print summary to console
  printSummary() {
    const summary = this.getSummary()
    console.log('\n' + '='.repeat(60))
    console.log('📊 EMAIL SYNC SUMMARY')
    console.log('='.repeat(60))
    console.log(`Duration: ${summary.duration}ms`)
    console.log(`Total Emails: ${summary.totalEmails}`)
    console.log(`Processed: ${summary.processedEmails}`)
    console.log(`Skipped: ${summary.skippedEmails}`)
    console.log(`  - Other type: ${summary.skippedReasons.otherType}`)
    console.log(`  - Low confidence: ${summary.skippedReasons.lowConfidence}`)
    console.log('\nMatch Results:')
    console.log(`  - Exact matches: ${summary.matchResults.exact}`)
    console.log(`  - Fuzzy matches: ${summary.matchResults.fuzzy}`)
    console.log(`  - Ambiguous: ${summary.matchResults.ambiguous}`)
    console.log(`  - No match: ${summary.matchResults.noMatch}`)
    console.log(`  - New jobs detected: ${summary.matchResults.newJobDetected}`)
    console.log(`\nJobs Updated: ${summary.jobsUpdated}`)
    console.log(`Notifications Created: ${summary.notificationsCreated}`)
    if (summary.errors.length > 0) {
      console.log(`\n⚠️  Errors (${summary.errors.length}):`)
      summary.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.message}`))
    }
    console.log('='.repeat(60) + '\n')
  }

  // Export logs as JSON (for debugging/analysis)
  exportAsJson(): string {
    return JSON.stringify({
      summary: this.getSummary(),
      logs: this.logs,
    }, null, 2)
  }
}

/**
 * Debug utility to test classification and matching on sample emails
 */
export function createTestEmail(subject: string, from: string, body: string): {
  id: string
  from: string
  to: string
  subject: string
  date: Date
  textBody: string
  htmlBody: string
} {
  return {
    id: `test-${Date.now()}`,
    from,
    to: 'user@example.com',
    subject,
    date: new Date(),
    textBody: body,
    htmlBody: `<p>${body}</p>`,
  }
}

/**
 * Debug utility to test job matching
 */
export function createTestJob(
  id: string,
  title: string,
  company: string,
  status: string,
  contactEmail?: string
): {
  id: string
  title: string
  company: string
  status: string
  url: string | null
  contactEmail: string | null
  contactName: string | null
  location: string | null
} {
  return {
    id,
    title,
    company,
    status,
    url: null,
    contactEmail: contactEmail || null,
    contactName: null,
    location: null,
  }
}
