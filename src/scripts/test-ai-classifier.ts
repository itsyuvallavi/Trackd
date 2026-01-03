#!/usr/bin/env bun
/**
 * Test AI Email Classifier
 * 
 * Quick test script to verify the AI classifier is working correctly.
 * 
 * Usage:
 *   bun run src/scripts/test-ai-classifier.ts
 * 
 * Note: Bun automatically loads .env files. Make sure OPENAI_API_KEY is set.
 */

import { AIClassifier } from '../lib/ai-email-classifier'
import { EmailType } from '../lib/ai-email-classifier'

// Test emails
const testEmails = [
  {
    id: 'test-1',
    from: 'noreply@greenhouse.io',
    to: 'user@example.com',
    subject: 'Thank you for applying to Software Engineer at Google',
    date: new Date(),
    textBody: 'Thank you for your interest in Google. We have received your application for the Software Engineer position. We will review your application and get back to you soon.',
    htmlBody: '',
  },
  {
    id: 'test-2',
    from: 'recruiter@company.com',
    to: 'user@example.com',
    subject: 'Interview Invitation - Software Engineer Position',
    date: new Date(),
    textBody: 'Hi! We would like to invite you for an interview for the Software Engineer position. Please let us know your availability for next week.',
    htmlBody: '',
  },
  {
    id: 'test-3',
    from: 'newsletter@linkedin.com',
    to: 'user@example.com',
    subject: 'New jobs matching your profile',
    date: new Date(),
    textBody: 'Check out these new job opportunities that match your profile!',
    htmlBody: '',
  },
  {
    id: 'test-4',
    from: 'hr@company.com',
    to: 'user@example.com',
    subject: 'Update on your application',
    date: new Date(),
    textBody: 'Unfortunately, we have decided to move forward with other candidates for this position. We appreciate your interest.',
    htmlBody: '',
  },
]

async function testClassifier() {
  console.log('🧪 Testing AI Email Classifier\n')
  console.log('=' .repeat(60))

  const classifier = new AIClassifier()

  for (const email of testEmails) {
    console.log(`\n📧 Email: ${email.subject}`)
    console.log(`From: ${email.from}`)
    console.log(`Body: ${email.textBody.substring(0, 100)}...`)

    try {
      const startTime = Date.now()
      const result = await classifier.classify(email)
      const duration = Date.now() - startTime

      console.log(`\n✅ Result:`)
      console.log(`  Type: ${result.type}`)
      console.log(`  Confidence: ${result.confidence}%`)
      console.log(`  Should Process: ${result.metadata.shouldProcess ?? 'N/A'}`)
      console.log(`  Reasoning: ${result.metadata.reasoning || 'N/A'}`)
      if (result.jobInfo?.company) {
        console.log(`  Company: ${result.jobInfo.company}`)
      }
      if (result.jobInfo?.title) {
        console.log(`  Title: ${result.jobInfo.title}`)
      }
      if (result.suggestedStatus) {
        console.log(`  Suggested Status: ${result.suggestedStatus}`)
      }
      console.log(`  Duration: ${duration}ms`)

      // Validate expected results
      if (email.id === 'test-1') {
        const expected = result.type === EmailType.APPLICATION_CONFIRMATION && result.metadata.shouldProcess
        console.log(`  ✅ Expected: APPLICATION_CONFIRMATION, shouldProcess=true | Got: ${expected ? '✅' : '❌'}`)
      } else if (email.id === 'test-2') {
        const expected = result.type === EmailType.INTERVIEW_INVITE && result.metadata.shouldProcess
        console.log(`  ✅ Expected: INTERVIEW_INVITE, shouldProcess=true | Got: ${expected ? '✅' : '❌'}`)
      } else if (email.id === 'test-3') {
        const expected = result.metadata.shouldProcess === false
        console.log(`  ✅ Expected: shouldProcess=false (newsletter) | Got: ${expected ? '✅' : '❌'}`)
      } else if (email.id === 'test-4') {
        const expected = result.type === EmailType.REJECTION && result.metadata.shouldProcess
        console.log(`  ✅ Expected: REJECTION, shouldProcess=true | Got: ${expected ? '✅' : '❌'}`)
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      if (error instanceof Error && error.stack) {
        console.error(`  Stack: ${error.stack}`)
      }
    }

    console.log('\n' + '-'.repeat(60))
  }

  // Show stats
  const stats = classifier.getStats()
  console.log(`\n📊 Statistics:`)
  console.log(`  Total Requests: ${stats.requestCount}`)
  console.log(`  Total Cost: $${stats.totalCost.toFixed(4)}`)
  console.log(`  Avg Cost/Request: $${stats.averageCostPerRequest.toFixed(4)}`)

  console.log('\n✅ Test complete!\n')
}

// Run test
testClassifier().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})

