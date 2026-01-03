/**
 * Entity Extraction Prompt
 * 
 * Extracts job-related information from emails
 */

import { EmailMessage } from '../../email-service'

export function getExtractionPrompt(email: EmailMessage): string {
  return `Extract job-related information from this email.

Email:
Subject: ${email.subject}
From: ${email.from}
Body: ${email.textBody.substring(0, 3000)}${email.textBody.length > 3000 ? '...' : ''}

Extract the following information:
- company: The company name (if mentioned)
- title: The job title/position (if mentioned)
- location: The job location (if mentioned)
- interviewDate: Date of interview if scheduled (format: YYYY-MM-DD or null)
- interviewTime: Time of interview if scheduled (format: HH:MM or null)
- nextSteps: Array of next action items mentioned
- contactName: Name of the contact person (if mentioned)
- contactEmail: Email of the contact person (if mentioned)
- salary: Salary or compensation mentioned (if any)
- rejectionReason: Reason for rejection (if this is a rejection email)

Return a JSON object with this exact structure:
{
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

Guidelines:
- Only extract information that is explicitly mentioned in the email
- If information is not found, use null (not empty string)
- For dates, use ISO format (YYYY-MM-DD)
- For times, use 24-hour format (HH:MM)
- Be accurate - don't guess or infer information
- Company name should be the actual company, not the job board or ATS

Return ONLY the JSON object, no other text.`
}

