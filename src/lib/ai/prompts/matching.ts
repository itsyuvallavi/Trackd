/**
 * Job Matching Prompt
 * 
 * Matches an email to existing jobs using semantic understanding
 */

import { ExtractedEntities } from '../types'

export interface JobCandidate {
  id: string
  title: string
  company: string
  location?: string | null
  contactEmail?: string | null
}

export function getMatchingPrompt(
  extracted: ExtractedEntities,
  candidates: JobCandidate[]
): string {
  const candidatesList = candidates
    .map(
      (job, idx) =>
        `${idx + 1}. ID: ${job.id}\n   Title: ${job.title}\n   Company: ${job.company}${job.location ? `\n   Location: ${job.location}` : ''}${job.contactEmail ? `\n   Contact: ${job.contactEmail}` : ''}`
    )
    .join('\n\n')

  return `Match this email to one of the user's existing job applications.

Extracted information from email:
- Company: ${extracted.company || 'Not found'}
- Title: ${extracted.title || 'Not found'}
- Location: ${extracted.location || 'Not found'}

User's existing jobs:
${candidatesList || 'No jobs found'}

Determine which job (if any) this email is about. Consider:
- Company name matching (exact or similar)
- Job title matching (exact or similar - e.g., "React Developer" matches "React.js Engineer")
- Location matching (if available)
- Contact email domain matching (if available)

Return a JSON object with this exact structure:
{
  "jobId": "job-id-string or null",
  "confidence": 0-100,
  "reasoning": "Brief explanation of the match decision",
  "requiresUserInput": true or false,
  "alternativeMatches": [
    {
      "jobId": "string",
      "confidence": 0-100,
      "title": "string",
      "company": "string"
    }
  ] or []
}

Guidelines:
- Set jobId to null if no confident match is found
- Set confidence based on how certain the match is (0-100)
- Set requiresUserInput to true if multiple jobs could match (ambiguous)
- Include alternativeMatches if there are 2+ possible matches
- If confidence is below 70, set requiresUserInput to true
- Consider variations in job titles (e.g., "Software Engineer" vs "Software Developer")
- Consider variations in company names (e.g., "Google" vs "Google LLC")

Return ONLY the JSON object, no other text.`
}

