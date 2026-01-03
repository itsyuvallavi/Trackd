/**
 * Email Classification Prompt
 * 
 * This prompt classifies emails and determines if they should be processed.
 * CRITICAL: Only process emails directly related to a specific job application.
 */

import { EmailMessage } from '../../email-service'

export function getClassificationPrompt(email: EmailMessage): string {
  return `You are analyzing emails for a job application tracking system. 
CRITICAL: Only process emails that are DIRECTLY related to a specific job application.

IGNORE these types of emails:
- General newsletters from job boards (LinkedIn, Indeed, etc.)
- Marketing emails from companies
- General career advice or tips
- Job board notifications about new jobs (not about YOUR application)
- Company updates/news that aren't about your application
- Promotional emails
- Unrelated personal or business emails

ONLY PROCESS emails that are about YOUR specific job application:
- Application confirmations ("We received your application")
- Interview invitations or scheduling
- Rejections for a specific position you applied to
- Job offers
- Follow-ups about your application status
- Updates about a position you applied to

Email to analyze:
Subject: ${email.subject}
From: ${email.from}
Body: ${email.textBody.substring(0, 2000)}${email.textBody.length > 2000 ? '...' : ''}

Classify this email as one of:
- APPLICATION_CONFIRMATION: Confirms they received your application
- INTERVIEW_INVITE: Invites you to interview or schedule a call
- REJECTION: Rejects your application for a specific job
- OFFER: Extends a job offer
- FOLLOW_UP: Follow-up about your application status
- OTHER: Not job-related OR general info (ignore these)

Return a JSON object with this exact structure:
{
  "type": "APPLICATION_CONFIRMATION" | "INTERVIEW_INVITE" | "REJECTION" | "OFFER" | "FOLLOW_UP" | "OTHER",
  "confidence": 0-100,
  "reasoning": "Brief explanation of why this classification was chosen",
  "shouldProcess": true or false
}

IMPORTANT:
- Set "shouldProcess" to false if the email is not directly about YOUR application
- Set "shouldProcess" to true only if the email is about a specific job you applied to
- Application confirmations ARE job-related and should have shouldProcess: true
- General newsletters, marketing emails, and job board notifications should have shouldProcess: false

Return ONLY the JSON object, no other text.`
}

