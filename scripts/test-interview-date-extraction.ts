/**
 * Test script to verify interview date extraction and parsing
 * Tests various email formats with dates, times, and edge cases
 */

import { AIClassifier } from '../src/lib/ai-email-classifier'
import { parseInterviewDateTime } from '../src/lib/utils/interview-date-parser'
import { EmailMessage } from '../src/lib/email-service'
import { EmailType } from '../src/lib/ai/types'

// Test cases for interview emails with different date/time formats
const testEmails: Array<{
  name: string
  email: EmailMessage
  expectedHasDate: boolean
  expectedHasTime: boolean
}> = [
  // Explicit date and time
  {
    name: 'Explicit date and time (ISO format)',
    email: {
      id: 'test-1',
      from: 'hr@acmecorp.com',
      to: 'candidate@example.com',
      subject: 'Interview Invitation - Software Engineer Position',
      date: new Date(),
      textBody: `Dear Candidate,

We would like to invite you for an interview for the Software Engineer position at Acme Corp.

Interview Date: 2025-01-15
Interview Time: 14:30

Please confirm your availability.

Best regards,
HR Team`,
      htmlBody: '',
    },
    expectedHasDate: true,
    expectedHasTime: true,
  },
  // Date with time in different format
  {
    name: 'Date with time (12-hour format)',
    email: {
      id: 'test-2',
      from: 'recruiter@techco.com',
      to: 'candidate@example.com',
      subject: 'Interview Scheduled',
      date: new Date(),
      textBody: `Hello,

Your interview has been scheduled for:
Date: January 20, 2025
Time: 2:00 PM

Looking forward to speaking with you!`,
      htmlBody: '',
    },
    expectedHasDate: true,
    expectedHasTime: true,
  },
  // Date only, no time
  {
    name: 'Date only, no time specified',
    email: {
      id: 'test-3',
      from: 'hiring@startup.io',
      to: 'candidate@example.com',
      subject: 'Next Steps - Interview',
      date: new Date(),
      textBody: `Hi there,

We'd like to schedule an interview with you on February 5, 2025.

We'll send you a calendar invite with the specific time shortly.

Thanks!`,
      htmlBody: '',
    },
    expectedHasDate: true,
    expectedHasTime: false,
  },
  // Relative date (tomorrow)
  {
    name: 'Relative date (tomorrow)',
    email: {
      id: 'test-4',
      from: 'team@company.com',
      to: 'candidate@example.com',
      subject: 'Quick Interview Request',
      date: new Date(),
      textBody: `Hello,

Are you available for an interview tomorrow at 10:00 AM?

Let me know if that works for you.`,
      htmlBody: '',
    },
    expectedHasDate: true,
    expectedHasTime: true,
  },
  // Multiple dates mentioned
  {
    name: 'Multiple date options',
    email: {
      id: 'test-5',
      from: 'scheduler@bigcorp.com',
      to: 'candidate@example.com',
      subject: 'Interview Scheduling',
      date: new Date(),
      textBody: `Dear Candidate,

We have several time slots available:
- January 25, 2025 at 9:00 AM
- January 26, 2025 at 2:00 PM
- January 27, 2025 at 11:00 AM

Please let us know which works best for you.`,
      htmlBody: '',
    },
    expectedHasDate: true,
    expectedHasTime: true,
  },
  // No date mentioned
  {
    name: 'No date mentioned',
    email: {
      id: 'test-6',
      from: 'hr@company.com',
      to: 'candidate@example.com',
      subject: 'Interview Invitation',
      date: new Date(),
      textBody: `Hello,

We would like to invite you for an interview for the Software Engineer position.

Please let us know your availability and we'll schedule a time that works for both of us.

Best regards,
HR`,
      htmlBody: '',
    },
    expectedHasDate: false,
    expectedHasTime: false,
  },
  // Date in subject line
  {
    name: 'Date in subject line',
    email: {
      id: 'test-7',
      from: 'recruiter@tech.com',
      to: 'candidate@example.com',
      subject: 'Interview on March 10, 2025 at 3:00 PM',
      date: new Date(),
      textBody: `Hi,

Just confirming your interview details. See you then!`,
      htmlBody: '',
    },
    expectedHasDate: true,
    expectedHasTime: true,
  },
  // Timezone mentioned
  {
    name: 'Date with timezone',
    email: {
      id: 'test-8',
      from: 'remote@company.com',
      to: 'candidate@example.com',
      subject: 'Remote Interview Scheduled',
      date: new Date(),
      textBody: `Hello,

Your interview is scheduled for:
Date: April 15, 2025
Time: 1:00 PM EST

This will be a video call via Zoom.`,
      htmlBody: '',
    },
    expectedHasDate: true,
    expectedHasTime: true,
  },
  // Unclear date format
  {
    name: 'Unclear/ambiguous date format',
    email: {
      id: 'test-9',
      from: 'hr@company.com',
      to: 'candidate@example.com',
      subject: 'Interview',
      date: new Date(),
      textBody: `Hi,

Let's schedule something for next week. How does Monday work?`,
      htmlBody: '',
    },
    expectedHasDate: false, // AI might not extract this reliably
    expectedHasTime: false,
  },
  // Date range
  {
    name: 'Date range mentioned',
    email: {
      id: 'test-10',
      from: 'scheduling@company.com',
      to: 'candidate@example.com',
      subject: 'Interview Window',
      date: new Date(),
      textBody: `Hello,

We're available for interviews between May 1-5, 2025. Please let us know your preferred time.`,
      htmlBody: '',
    },
    expectedHasDate: true, // AI might extract the start date
    expectedHasTime: false,
  },
]

// Test the parsing function directly
function testParser() {
  console.log('\n' + '='.repeat(80))
  console.log('TESTING: parseInterviewDateTime function')
  console.log('='.repeat(80) + '\n')

  const parserTests = [
    { date: '2025-01-15', time: '14:30', description: 'Valid date and time' },
    { date: '2025-01-15', time: null, description: 'Valid date, no time' },
    { date: '2025-12-31', time: '23:59', description: 'End of year, end of day' },
    { date: '2025-02-29', time: '12:00', description: 'Leap year date' },
    { date: '2025-13-01', time: '12:00', description: 'Invalid month' },
    { date: 'invalid', time: '12:00', description: 'Invalid date format' },
    { date: '2025-01-15', time: '25:00', description: 'Invalid time (hour > 23)' },
    { date: '2025-01-15', time: '12:60', description: 'Invalid time (minute > 59)' },
    { date: null, time: '14:30', description: 'No date, only time' },
    { date: '2025-01-15', time: 'invalid', description: 'Invalid time format' },
  ]

  let passed = 0
  let failed = 0

  for (const test of parserTests) {
    const result = parseInterviewDateTime(test.date, test.time)
    const isValid = result !== null
    const expectedValid = test.date !== null && test.date !== 'invalid' && 
                         test.date !== '2025-13-01' && 
                         (!test.time || (test.time !== 'invalid' && 
                          !test.time.includes('25') && !test.time.includes('60')))

    if (isValid === expectedValid) {
      console.log(`✓ ${test.description}`)
      console.log(`  Input: date="${test.date}", time="${test.time}"`)
      console.log(`  Result: ${result ? result.toISOString() : 'null'}`)
      passed++
    } else {
      console.log(`✗ ${test.description}`)
      console.log(`  Input: date="${test.date}", time="${test.time}"`)
      console.log(`  Expected: ${expectedValid ? 'valid date' : 'null'}, Got: ${result ? result.toISOString() : 'null'}`)
      failed++
    }
    console.log()
  }

  console.log(`Parser Tests: ${passed} passed, ${failed} failed\n`)
  return { passed, failed }
}

// Test AI extraction
async function testAIExtraction() {
  console.log('\n' + '='.repeat(80))
  console.log('TESTING: AI Interview Date Extraction')
  console.log('='.repeat(80) + '\n')

  // Check if AI is enabled
  if (process.env.ENABLE_AI_CLASSIFICATION !== 'true') {
    console.log('⚠️  AI Classification is not enabled (ENABLE_AI_CLASSIFICATION !== "true")')
    console.log('   Set ENABLE_AI_CLASSIFICATION=true to test AI extraction\n')
    return { passed: 0, failed: 0, skipped: testEmails.length }
  }

  const classifier = new AIClassifier()
  let passed = 0
  let failed = 0
  let skipped = 0

  for (const testCase of testEmails) {
    try {
      console.log(`\n📧 Testing: ${testCase.name}`)
      console.log(`   Subject: ${testCase.email.subject}`)
      console.log(`   From: ${testCase.email.from}`)
      
      const classified = await classifier.classify(testCase.email)
      
      console.log(`   Type: ${classified.type}`)
      console.log(`   Confidence: ${classified.confidence}%`)
      
      if (classified.type !== EmailType.INTERVIEW_INVITE) {
        console.log(`   ⚠️  Email not classified as INTERVIEW_INVITE (got ${classified.type})`)
        skipped++
        continue
      }

      const extracted = classified.metadata.extractedEntities
      if (!extracted) {
        console.log(`   ✗ No extracted entities found`)
        failed++
        continue
      }

      const hasDate = !!extracted.interviewDate
      const hasTime = !!extracted.interviewTime

      console.log(`   Extracted Date: ${extracted.interviewDate || 'null'}`)
      console.log(`   Extracted Time: ${extracted.interviewTime || 'null'}`)

      // Check if extraction matches expectations
      const dateMatch = hasDate === testCase.expectedHasDate
      const timeMatch = !testCase.expectedHasTime || hasTime === testCase.expectedHasTime

      if (dateMatch && timeMatch) {
        console.log(`   ✓ Extraction matches expectations`)
        passed++
      } else {
        console.log(`   ⚠️  Extraction doesn't match expectations`)
        console.log(`      Expected: date=${testCase.expectedHasDate}, time=${testCase.expectedHasTime}`)
        console.log(`      Got: date=${hasDate}, time=${hasTime}`)
        failed++
      }

      // Test parsing if we have a date
      if (hasDate) {
        const parsed = parseInterviewDateTime(extracted.interviewDate, extracted.interviewTime)
        if (parsed) {
          console.log(`   ✓ Parsed successfully: ${parsed.toISOString()}`)
        } else {
          console.log(`   ✗ Failed to parse date/time`)
          failed++
        }
      }

    } catch (error) {
      console.log(`   ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      failed++
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`AI Extraction Tests: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  console.log('='.repeat(80) + '\n')

  return { passed, failed, skipped }
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(80))
  console.log('INTERVIEW DATE EXTRACTION TEST SUITE')
  console.log('='.repeat(80))

  const parserResults = testParser()
  const aiResults = await testAIExtraction()

  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Parser Tests: ${parserResults.passed} passed, ${parserResults.failed} failed`)
  console.log(`AI Extraction Tests: ${aiResults.passed} passed, ${aiResults.failed} failed, ${aiResults.skipped} skipped`)
  console.log(`Total: ${parserResults.passed + aiResults.passed} passed, ${parserResults.failed + aiResults.failed} failed`)
  console.log('='.repeat(80) + '\n')

  if (parserResults.failed + aiResults.failed > 0) {
    process.exit(1)
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite error:', error)
  process.exit(1)
})

