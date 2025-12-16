// Test script to verify email connection and fetching
import { createEmailService } from './src/lib/email-service'
import { EmailClassifier } from './src/lib/email-classifier'

async function testEmailSync() {
  console.log('Testing email connection...')

  try {
    const emailService = createEmailService()

    // Test connection
    console.log('Testing connection to IMAP server...')
    await emailService.testConnection()
    console.log('✓ Connection successful!')

    // Fetch emails from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    console.log(`\nFetching emails since ${thirtyDaysAgo.toLocaleDateString()}...`)

    const emails = await emailService.fetchEmailsSince(thirtyDaysAgo)
    console.log(`✓ Fetched ${emails.length} emails\n`)

    // Classify each email
    const classifier = new EmailClassifier()

    console.log('Classifying emails...\n')
    for (const email of emails.slice(0, 10)) {
      // Show first 10
      const classified = classifier.classify(email)

      console.log('---')
      console.log(`From: ${email.from}`)
      console.log(`Subject: ${email.subject}`)
      console.log(`Date: ${email.date}`)
      console.log(`Type: ${classified.type}`)
      console.log(`Confidence: ${classified.confidence.toFixed(1)}%`)
      console.log(`Suggested Status: ${classified.suggestedStatus || 'None'}`)
      console.log(`Job Info:`, classified.jobInfo)
      console.log(`Keywords: ${classified.metadata.keywords.join(', ')}`)
      console.log()
    }

    console.log(`\nShowing first 10 of ${emails.length} total emails`)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

testEmailSync()
