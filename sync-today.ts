// Sync emails from TODAY only
import { prisma } from './src/lib/prisma'
import { createEmailService } from './src/lib/email-service'
import { EmailClassifier, EmailType } from './src/lib/email-classifier'

async function syncToday() {
  console.log('🔄 Fetching emails from TODAY (Dec 15, 2025)...\n')

  const userId = 'temp-user'

  try {
    // Fetch emails from today
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today

    console.log(`Fetching emails since ${today.toLocaleString()}...\n`)

    const emailService = createEmailService()
    const emails = await emailService.fetchEmailsSince(today)

    console.log(`✓ Fetched ${emails.length} emails from today\n`)

    // Show all emails from today
    console.log('Emails from today:')
    emails.forEach((email, i) => {
      console.log(`\n[${i + 1}] From: ${email.from}`)
      console.log(`    Subject: ${email.subject}`)
      console.log(`    Date: ${email.date}`)
    })

    // Classify and create jobs
    const classifier = new EmailClassifier()
    let createdCount = 0

    for (const email of emails) {
      const classified = classifier.classify(email)

      console.log(`\n--- Classifying: ${email.subject}`)
      console.log(`    Type: ${classified.type}`)
      console.log(`    Confidence: ${classified.confidence}`)
      console.log(`    Matched keywords: ${classified.metadata.keywords.join(', ')}`)
      console.log(`    Company: ${classified.jobInfo?.company || 'NOT FOUND'}`)
      console.log(`    Title: ${classified.jobInfo?.title || 'NOT FOUND'}`)

      if (classified.type === EmailType.OTHER || classified.confidence < 20) {
        console.log(`    ⊘ Skipping: type=${classified.type}, confidence=${classified.confidence}`)
        continue
      }

      if (!classified.jobInfo?.company) {
        console.log(`    ⊘ Skipping: no company extracted`)
        continue
      }

      let jobTitle = classified.jobInfo.title

      // If no title extracted, use a fallback: "Position at [Company]"
      if (!jobTitle) {
        jobTitle = `Position at ${classified.jobInfo.company}`
      } else {
        // Clean up the title
        jobTitle = jobTitle
          .replace(/^(Re:|Fwd:|Thank you for|Thanks for|Update on|Application|Your application|Software Mind:)/gi, '')
          .replace(/(at|@)\s*$/i, '')
          .trim()
      }

      if (!jobTitle || jobTitle.length < 3) {
        jobTitle = `Position at ${classified.jobInfo.company}`
      }

      // Check if job already exists
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
        console.log(`\n⊘ Job already exists: ${classified.jobInfo.company}`)
        continue
      }

      console.log(`\n📧 Creating job:`)
      console.log(`   Company: ${classified.jobInfo.company}`)
      console.log(`   Title: ${jobTitle}`)
      console.log(`   Status: ${classified.suggestedStatus}`)

      await prisma.job.create({
        data: {
          userId,
          title: jobTitle,
          company: classified.jobInfo.company,
          source: 'OTHER',
          status: classified.suggestedStatus || 'SAVED',
          priority: 'B',
          notes: email.textBody.substring(0, 2000),
        },
      })

      createdCount++
    }

    console.log(`\n✅ Created ${createdCount} new jobs from today's emails`)
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

syncToday()
