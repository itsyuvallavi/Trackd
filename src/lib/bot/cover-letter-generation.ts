import type { ResumeStructuredData } from '@/lib/bot/resume/types'

const BANNED_PHRASES_BLOCK = `Never use these phrases or obvious variants:
"passionate about", "results-driven", "proven track record", "I am excited to", "I believe my skills align",
"leverage", "delve", "robust ecosystem", "dynamic environment", "synergy",
"In today's fast-paced", "cutting-edge" (unless quoting the posting), "game-changer",
"I am writing to express my interest", "I am writing to express my enthusiasm",
"at your earliest convenience", "Thank you for considering my application" (use a shorter, warmer close instead).`

const FORMAT_RULES = `Formatting (critical):
- Do NOT include letterhead: no mailing address block, no date line, no "[placeholder]" lines, no recipient address block under "Hiring Manager".
- The letter MUST begin with the salutation line only (e.g. "Dear Hiring Manager," or "Dear Natixis team,"), then the body — nothing above it.
- End with a brief sign-off and the candidate's real name only (no fabricated contact lines).`

/** Persona + constraints for the first draft. */
export const COVER_LETTER_SYSTEM_PROMPT = `You are an experienced career writer who drafts cover letters that sound like a real person typed them — confident and conversational, not corporate-AI filler.

Voice:
- Natural English; use contractions where they fit (I've, I'm, I'd, it's, that's) without overdoing it.
- Vary sentence length: mix short sentences with longer ones.
- Write to one reader; avoid stiff, generic "applicant voice."

${BANNED_PHRASES_BLOCK}

Opening: do NOT open with formulaic "I am writing to apply…" hooks. Start with substance — why this role fits you or one concrete angle — still beginning after the salutation line.

${FORMAT_RULES}

Rhythm (optional, subtle — do not force every trick):
- You may start ONE sentence with "And" or "But" where it reads naturally.
- You may include ONE very short punchy sentence (under 10 words) among longer sentences.

Output: the letter text only. No preamble, markdown, or title.`

/** Second pass: tighten voice and strip residual AI tells. */
export const COVER_LETTER_POLISH_SYSTEM_PROMPT = `You edit cover letters so they read human and specific, not AI-generated.

Keep: factual claims about experience, employers, technologies, job title, and location when relevant.
Remove: hollow enthusiasm, repetitive "I…" openings, buzzwords, and filler.

${BANNED_PHRASES_BLOCK}

${FORMAT_RULES}

Preserve meaning; improve flow, contractions where natural, and sentence variety.
Return ONLY the final letter text.`

export type CoverLetterJobContext = {
  title: string
  company: string
  location: string | null
  botReasoning: string | null
  notes: string | null
}

function achievementsAndMetrics(resume: ResumeStructuredData): string {
  const lines: string[] = []
  for (const exp of resume.experience.slice(0, 4)) {
    const bits: string[] = []
    if (exp.achievements?.length) {
      for (const a of exp.achievements.slice(0, 3)) {
        if (a.trim()) bits.push(a.trim())
      }
    }
    const descFirst = exp.description.split(/[.\n]/)[0]?.trim()
    if (bits.length === 0 && descFirst && descFirst.length < 220) bits.push(descFirst)
    if (bits.length > 0) lines.push(`  - ${exp.title} @ ${exp.company}: ${bits.join('; ')}`)
  }
  return lines.length > 0 ? `\nHighlighted wins / specifics (use sparingly — tie to role, don't list):\n${lines.join('\n')}` : ''
}

export function buildCoverLetterUserPrompt(
  job: CoverLetterJobContext,
  resumeSection: string
): string {
  const notesBlock =
    job.notes && job.notes.trim().length > 0
      ? `\nJob / posting context (user notes or pasted description — prioritize requirements you can honestly match):\n${job.notes.slice(0, 4000)}\n`
      : ''

  return `Draft a cover letter for this application.

JOB
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
${job.botReasoning ? `Matcher notes (why this listing fit the profile): ${job.botReasoning}\n` : ''}${notesBlock}
${resumeSection}

Guidelines:
- About 250–320 words, 3–4 short paragraphs after the salutation.
- Focus on fit for THIS role: map capabilities to what they likely need from the title and any posting context above. Prefer "how I'd help you" over long stories about past products.
- At most one tight example that names a past employer or stack if it directly proves fit.
- Specific beats vague: prefer concrete tools, scope, or outcomes already in the resume section when truthful.
- Salutation first line only; then body; warm professional close + candidate name.

Return ONLY the letter text.`
}

export function buildResumeSectionForCoverLetter(resume: ResumeStructuredData | null): string {
  if (!resume) return 'No structured resume — write from job context only; still use a plausible professional voice.'

  const contactLines = [
    resume.email ? `Email: ${resume.email}` : null,
    resume.phone ? `Phone: ${resume.phone}` : null,
    resume.location ? `Location: ${resume.location}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const achievements = achievementsAndMetrics(resume)

  return `
CANDIDATE (from resume — facts only; do not invent metrics not listed)
Name: ${resume.name}
${contactLines ? `${contactLines}\n` : ''}${resume.summary ? `Summary: ${resume.summary}\n` : ''}Skills: ${resume.skills.slice(0, 28).join(', ')}
Experience:
${resume.experience
  .slice(0, 4)
  .map(
    (e) =>
      `  - ${e.title} at ${e.company} (${e.startDate}–${e.endDate})\n    ${e.description.slice(0, 380)}`
  )
  .join('\n')}
${achievements}
Education:
${resume.education.map((e) => `  - ${e.degree} in ${e.field ?? 'N/A'} from ${e.institution}`).join('\n')}
`.trim()
}

export function buildPolishUserPrompt(draft: string): string {
  return `Rewrite the following cover letter to sound more natural and human. Keep all true facts; remove AI-y phrasing and letterhead if it crept in. Output only the final letter.

---
${draft}
---`
}
