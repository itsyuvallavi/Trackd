// Sync most recent emails (to catch today's emails)
import { prisma } from './src/lib/prisma'
import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { EmailClassifier, EmailType } from './src/lib/email-classifier'

async function syncRecent() {
  console.log('🔄 Fetching most recent emails...\n')

  const userId = 'temp-user'

  const imap = new Imap({
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT!),
    user: process.env.IMAP_USERNAME!,
    password: process.env.IMAP_PASSWORD!,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  })

  const messages: any[] = []

  await new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err: any, box: any) => {
        if (err) {
          reject(err)
          return
        }

        console.log(`✓ INBOX opened. Total messages: ${box.messages.total}`)

        // Get last 50 emails
        const start = Math.max(1, box.messages.total - 49)
        const end = box.messages.total
        console.log(`Fetching emails ${start} to ${end}...\n`)

        const fetch = imap.fetch(`${start}:${end}`, { bodies: '' })

        fetch.on('message', (msg: any) => {
          msg.on('body', (stream: any) => {
            simpleParser(stream, (err: any, parsed: any) => {
              if (!err) {
                const from = Array.isArray(parsed.from?.value)
                  ? parsed.from.value[0]?.address || ''
                  : parsed.from?.text || ''

                messages.push({
                  from,
                  subject: parsed.subject || '',
                  date: parsed.date || new Date(),
                  textBody: parsed.text || '',
                })
              }
            })
          })
        })

        fetch.once('end', () => {
          setTimeout(() => {
            imap.end()
          }, 1000)
        })
      })
    })

    imap.once('end', () => {
      resolve(messages)
    })

    imap.once('error', (err: any) => {
      reject(err)
    })

    imap.connect()
  })

  console.log(`✓ Fetched ${messages.length} recent emails\n`)

  // Find the rejection emails you mentioned
  const exotrail = messages.find((m) => m.from.includes('exotrail'))
  const sunrise = messages.find((m) => m.from.includes('sunrise'))
  const softwareMind = messages.find((m) => m.from.includes('smartrecruiters'))

  console.log('Looking for specific emails:')
  console.log(`Exotrail: ${exotrail ? '✓ FOUND' : '✗ NOT FOUND'}`)
  console.log(`Sunrise: ${sunrise ? '✓ FOUND' : '✗ NOT FOUND'}`)
  console.log(`Software Mind: ${softwareMind ? '✓ FOUND' : '✗ NOT FOUND'}`)

  // Process all job-related emails
  const classifier = new EmailClassifier()
  let createdCount = 0

  for (const email of messages) {
    const classified = classifier.classify(email)

    if (classified.type === EmailType.OTHER || classified.confidence < 20) {
      continue
    }

    if (!classified.jobInfo?.company) {
      continue
    }

    let jobTitle = classified.jobInfo.title || email.subject
    jobTitle = jobTitle
      .replace(/^(Re:|Fwd:|Thank you for|Thanks for|Update on|Application|Your application|Software Mind:)/gi, '')
      .replace(/(at|@)\s*$/i, '')
      .trim()

    if (!jobTitle || jobTitle.length < 5) {
      continue
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
      continue
    }

    console.log(`\n📧 Creating job from email:`)
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

  console.log(`\n✅ Created ${createdCount} new jobs`)
  process.exit(0)
}

syncRecent().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
