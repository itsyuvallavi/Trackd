// Setup email integration and sync emails
import { prisma } from '../src/lib/prisma'
import { createEmailService } from '../src/lib/email-service'
import { EmailClassifier, EmailType } from '../src/lib/email-classifier'

async function setupAndSync() {
  console.log('🔧 Setting up email integration...\n')

  const userId = 'temp-user'

  // Save email integration to database
  await prisma.emailIntegration.upsert({
    where: { userId },
    create: {
      userId,
      provider: 'IMAP',
      email: process.env.EMAIL_ADDRESS!,
      imapHost: process.env.IMAP_HOST!,
      imapPort: parseInt(process.env.IMAP_PORT!),
      imapUsername: process.env.IMAP_USERNAME!,
      imapPassword: process.env.IMAP_PASSWORD!,
      isActive: true,
    },
    update: {
      email: process.env.EMAIL_ADDRESS!,
      imapHost: process.env.IMAP_HOST!,
      imapPort: parseInt(process.env.IMAP_PORT!),
      imapUsername: process.env.IMAP_USERNAME!,
      imapPassword: process.env.IMAP_PASSWORD!,
      isActive: true,
      lastError: null,
    },
  })

  console.log('✓ Email integration configured\n')
  console.log('🔄 Starting email sync...\n')

  try {
    // Fetch emails from last 7 days (including today)
    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    console.log(`Fetching emails from ${sevenDaysAgo.toLocaleDateString()} to ${today.toLocaleDateString()}...\n`)

    const emailService = createEmailService({
      host: process.env.IMAP_HOST!,
      port: parseInt(process.env.IMAP_PORT!),
      user: process.env.IMAP_USERNAME!,
      password: process.env.IMAP_PASSWORD!,
    })
    const emails = await emailService.fetchEmailsSince(sevenDaysAgo)

    console.log(`✓ Fetched ${emails.length} emails\n`)

    // Classify and create jobs from emails
    const classifier = new EmailClassifier()
    let createdCount = 0

    for (const email of emails) {
      const classified = classifier.classify(email)

      // Only process job-related emails with reasonable confidence
      if (classified.type === EmailType.OTHER || classified.confidence < 20) {
        continue
      }

      // Skip if no job info extracted
      if (!classified.jobInfo?.company) {
        continue
      }

      // Extract job title from subject if not in jobInfo
      let jobTitle = classified.jobInfo.title

      // If no title extracted, use a fallback: "Position at [Company]"
      if (!jobTitle) {
        jobTitle = `Position at ${classified.jobInfo.company}`
      } else {
        // Clean up common subject line patterns
        jobTitle = jobTitle
          .replace(/^(Re:|Fwd:|Thank you for|Thanks for|Update on|Application|Your application)/gi, '')
          .replace(/(at|@)\s*$/i, '')
          .trim()
      }

      // If still no meaningful title, use fallback
      if (!jobTitle || jobTitle.length < 3) {
        jobTitle = `Position at ${classified.jobInfo.company}`
      }

      console.log(`\n📧 Found job-related email:`)
      console.log(`   Subject: ${email.subject}`)
      console.log(`   Company: ${classified.jobInfo.company}`)
      console.log(`   Title: ${jobTitle}`)
      console.log(`   Type: ${classified.type}`)
      console.log(`   Suggested Status: ${classified.suggestedStatus || 'SAVED'}`)

      // Check if job already exists for this company
      const existingJob = await prisma.job.findFirst({
        where: {
          userId,
          company: {
            contains: classified.jobInfo.company,
            mode: 'insensitive',
          },
        },
      })

      if (existingJob) {
        console.log(`   ⊘ Job already exists, skipping`)
        continue
      }

      // Create new job
      const newJob = await prisma.job.create({
        data: {
          userId,
          title: jobTitle,
          company: classified.jobInfo.company,
          location: classified.jobInfo.location || null,
          source: 'OTHER',
          status: classified.suggestedStatus || 'SAVED',
          priority: 'B',
          notes: email.textBody.substring(0, 2000),
        },
      })

      // Create initial activity
      await prisma.activity.create({
        data: {
          jobId: newJob.id,
          userId,
          type: 'EMAIL_UPDATE',
          toStatus: classified.suggestedStatus || 'SAVED',
          description: `Detected from email: ${email.subject}`,
        },
      })

      console.log(`   ✓ Created job!`)
      createdCount++
    }

    // Update last synced timestamp
    await prisma.emailIntegration.update({
      where: { userId },
      data: {
        lastSyncedAt: new Date(),
        lastError: null,
      },
    })

    console.log(`\n\n✅ Sync complete!`)
    console.log(`   Total emails: ${emails.length}`)
    console.log(`   Jobs created: ${createdCount}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)

    // Log error to database
    await prisma.emailIntegration.update({
      where: { userId },
      data: {
        lastError: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    process.exit(1)
  }
}

setupAndSync()
