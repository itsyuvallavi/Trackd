/**
 * Combined email review prompt.
 *
 * Classifies whether an email is a specific job-application update and, when
 * relevant, extracts the job/application entities in one model call.
 */

import { EmailMessage } from '../../email-service'

export function getEmailReviewPrompt(email: EmailMessage): string {
  return `You are analyzing emails for a job application tracking system.
CRITICAL: Only process emails that are DIRECTLY related to a specific job application.

IGNORE these types of emails:
- General newsletters from job boards (LinkedIn, Indeed, Naukri, etc.)
- Marketing emails from companies
- General career advice or tips
- Job board notifications about new jobs (not about YOUR application)
- Company updates/news that are not about your application
- Promotional emails
- One-time passwords, verification codes, login codes, security alerts, magic links, password setup emails, and terms/GDPR consent emails
- Unrelated personal, billing, subscription, or business emails

ONLY PROCESS emails that are about YOUR specific job application:
- Application confirmations
- Interview invitations or scheduling
- Rejections for a specific position you applied to
- Job offers
- Follow-ups about your application status
- Updates about a position you applied to

Email to analyze:
Subject: ${email.subject}
From: ${email.from}
Body: ${email.textBody.substring(0, 3000)}${email.textBody.length > 3000 ? '...' : ''}

Return a JSON object with this exact structure:
{
  "type": "APPLICATION_CONFIRMATION" | "INTERVIEW_INVITE" | "REJECTION" | "OFFER" | "FOLLOW_UP" | "OTHER",
  "confidence": 0-100,
  "reasoning": "Brief explanation of why this classification was chosen",
  "shouldProcess": true or false,
  "extractedEntities": {
    "company": "string or null",
    "title": "string or null",
    "location": "string or null",
    "interviewDate": "YYYY-MM-DD or null",
    "interviewTime": "HH:MM or null",
    "nextSteps": ["array", "of", "strings"] or [],
    "contactName": "string or null",
    "contactEmail": "string or null",
    "salary": "string or null",
    "rejectionReason": "string or null"
  }
}

Rules:
- Set shouldProcess=false for OTP/security/login/password/GDPR/terms messages, even if a company name appears.
- Set shouldProcess=false for job recommendations and job-board marketing.
- Only extract company/title/location that are explicitly present in the email. Do not guess.
- Company name should be the actual company, not the ATS/job board, unless no actual company is present.
- If shouldProcess=false, still return extractedEntities with nulls and nextSteps: [].
- For dates, use ISO format YYYY-MM-DD when explicit.
- For times, use 24-hour format HH:MM when explicit.

Return ONLY the JSON object, no other text.`
}
