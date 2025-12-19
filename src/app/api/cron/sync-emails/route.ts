import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmailService } from '@/lib/email-service'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify this is called by Vercel Cron (in production)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('🔄 Starting scheduled email sync...')

    // Get all active email integrations
    const integrations = await prisma.emailIntegration.findMany({
      where: { isActive: true },
    })

    if (integrations.length === 0) {
      return NextResponse.json({ message: 'No active integrations' })
    }

    let totalJobsCreated = 0

    for (const integration of integrations) {
      try {
        console.log(`Syncing emails for user: ${integration.userId}`)

        // Fetch emails from last sync or last hour
        const since = integration.lastSyncedAt || new Date(Date.now() - 60 * 60 * 1000)

        // Only process integrations with IMAP config
        if (!integration.imapHost || !integration.imapPort || !integration.imapUsername || !integration.imapPassword) {
          console.log(`Skipping integration ${integration.id}: missing IMAP config`)
          continue
        }

        const emailService = createEmailService({
          host: integration.imapHost,
          port: integration.imapPort,
          user: integration.imapUsername,
          password: integration.imapPassword,
        })
        const emails = await emailService.fetchEmailsSince(since)

        console.log(`Fetched ${emails.length} emails for ${integration.userId}`)

        // Classify and create jobs
        const classifier = new EmailClassifier()
        let createdCount = 0

        for (const email of emails) {
          const classified = classifier.classify(email)

          // Skip non-job emails
          if (classified.type === EmailType.OTHER || classified.confidence < 20) {
            continue
          }

          if (!classified.jobInfo?.company) {
            continue
          }

          // Generate job title
          let jobTitle = classified.jobInfo.title
          if (!jobTitle) {
            jobTitle = `Position at ${classified.jobInfo.company}`
          } else {
            jobTitle = jobTitle
              .replace(/^(Re:|Fwd:|Thank you for|Thanks for|Update on|Application|Your application)/gi, '')
              .replace(/(at|@)\s*$/i, '')
              .trim()
          }

          if (!jobTitle || jobTitle.length < 3) {
            jobTitle = `Position at ${classified.jobInfo.company}`
          }

          // Check if job already exists
          const existingJob = await prisma.job.findFirst({
            where: {
              userId: integration.userId,
              company: {
                contains: classified.jobInfo.company,
                mode: 'insensitive',
              },
            },
          })

          if (existingJob) {
            continue
          }

          // Create new job
          const newJob = await prisma.job.create({
            data: {
              userId: integration.userId,
              title: jobTitle,
              company: classified.jobInfo.company,
              location: classified.jobInfo.location || null,
              source: 'OTHER',
              status: classified.suggestedStatus || 'SAVED',
              priority: 'B',
              notes: email.textBody.substring(0, 2000),
            },
          })

          // Create activity
          await prisma.activity.create({
            data: {
              jobId: newJob.id,
              userId: integration.userId,
              type: 'EMAIL_UPDATE',
              toStatus: classified.suggestedStatus || 'SAVED',
              description: `Detected from email: ${email.subject}`,
            },
          })

          createdCount++
        }

        // Update last synced timestamp
        await prisma.emailIntegration.update({
          where: { id: integration.id },
          data: {
            lastSyncedAt: new Date(),
            lastError: null,
          },
        })

        totalJobsCreated += createdCount
        console.log(`Created ${createdCount} jobs for ${integration.userId}`)
      } catch (error) {
        console.error(`Error syncing for user ${integration.userId}:`, error)

        // Log error to database
        await prisma.emailIntegration.update({
          where: { id: integration.id },
          data: {
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      totalJobsCreated,
      integrationsProcessed: integrations.length,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
