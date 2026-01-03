// One-time script to sync emails and update jobs
import { prisma } from '../src/lib/prisma'
import { createEmailService } from '../src/lib/email-service'
import { EmailClassifier, EmailType } from '../src/lib/email-classifier'
import { ActivityType, JobStatus } from '@prisma/client'

async function syncEmailsNow() {
  console.log('🔄 Starting email sync...\n')

  const userId = 'temp-user'

  try {
    // Fetch emails from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    console.log(`Fetching emails since ${sevenDaysAgo.toLocaleDateString()}...`)

    const emailService = createEmailService({
      host: process.env.IMAP_HOST!,
      port: parseInt(process.env.IMAP_PORT!),
      user: process.env.IMAP_USERNAME!,
      password: process.env.IMAP_PASSWORD!,
    })
    const emails = await emailService.fetchEmailsSince(sevenDaysAgo)

    console.log(`\n✓ Fetched ${emails.length} emails\n`)

    // Get all user's jobs for matching
    const jobs = await prisma.job.findMany({
      where: { userId },
      select: { id: true, title: true, company: true, url: true, status: true },
    })

    console.log(`Found ${jobs.length} jobs in database\n`)

    // Classify and process each email
    const classifier = new EmailClassifier()
    let processedCount = 0
    let updatedCount = 0

    for (const email of emails) {
      const classified = classifier.classify(email)

      // Only process job-related emails
      if (classified.type === EmailType.OTHER || classified.confidence < 20) {
        continue
      }

      processedCount++

      console.log(`\n📧 Processing: ${email.subject}`)
      console.log(`   From: ${email.from}`)
      console.log(`   Type: ${classified.type}`)
      console.log(`   Confidence: ${classified.confidence.toFixed(1)}%`)
      console.log(`   Suggested Status: ${classified.suggestedStatus || 'None'}`)

      // Try to match email to existing job
      const matchResult = classifier.matchToJob(classified, jobs, email)

      if ((matchResult.confidence === 'exact' || matchResult.confidence === 'fuzzy') && matchResult.jobId && classified.suggestedStatus) {
        const job = jobs.find((j) => j.id === matchResult.jobId)
        console.log(`   ✓ Matched to job: "${job?.title}" at ${job?.company}`)

        // Only update if it's a status advancement (don't go backwards)
        const shouldUpdate = shouldUpdateStatus(job?.status, classified.suggestedStatus)

        if (shouldUpdate) {
          // Update job status
          await prisma.job.update({
            where: { id: matchResult.jobId },
            data: { status: classified.suggestedStatus },
          })

          // Create activity record
          await prisma.activity.create({
            data: {
              jobId: matchResult.jobId,
              userId,
              type: getActivityType(classified.type),
              fromStatus: job?.status,
              toStatus: classified.suggestedStatus,
              description: `Email detected: ${email.subject}`,
            },
          })

          console.log(`   ✓ Updated status: ${job?.status} → ${classified.suggestedStatus}`)
          updatedCount++
        } else {
          console.log(`   ⊘ Skipped (status would not advance)`)
        }
      } else {
        console.log(`   ⊘ No matching job found`)
      }
    }

    console.log(`\n\n✅ Sync complete!`)
    console.log(`   Total emails: ${emails.length}`)
    console.log(`   Job-related emails: ${processedCount}`)
    console.log(`   Jobs updated: ${updatedCount}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

function shouldUpdateStatus(
  currentStatus: JobStatus | undefined,
  suggestedStatus: JobStatus
): boolean {
  if (!currentStatus) return true

  const statusHierarchy = {
    SAVED: 0,
    APPLIED: 1,
    INTERVIEW: 2,
    OFFER: 3,
    REJECTED: 99,
    ARCHIVED: 99,
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

syncEmailsNow()
