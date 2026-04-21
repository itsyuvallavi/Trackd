/**
 * Structured "knowledge bank" for job-application automation.
 * The model uses this text to decide values and actions — not hardcoded ATS rules.
 */

import type { ApplicationProfile } from '@prisma/client'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'
import { isUnsafeFullAutomation } from '@/lib/bot/apply/automation-mode'

export interface ApplicationJobContext {
  title: string
  company: string
  description?: string | null
  /** Posting URL — used for host-specific plan fixes (e.g. Dice email gate). */
  jobUrl?: string
  /** Preferred email for gate forms; falls back to resume in the generic adapter. */
  applicationEmail?: string | null
}

function resolvePortalSignupPassword(profile: ApplicationProfile | null): string {
  const fromProfile = profile?.portalSignupPassword?.trim()
  if (fromProfile) return fromProfile
  return process.env.BROWSER_APPLY_PORTAL_PASSWORD?.trim() ?? ''
}

function portalSignupCredentialsBlock(profile: ApplicationProfile | null): string {
  const pw = resolvePortalSignupPassword(profile)
  if (!pw) {
    return ''
  }
  return `
## Portal / job-board signup (automation only)
- Some employers route you through a **host job board account** (sign up / sign in) before the real application. You may **fill** password-type fields on those gates using this **exact** value (and only in \`type="password"\` or clearly labeled password fields — never paste into cover letter or notes):
  - **Password:** \`${pw.replace(/`/g, "'")}\`
`.trim()
}

/**
 * Markdown document: facts + policies the planner and field-filler may use.
 */
export function buildApplicationKnowledgeBank(
  job: ApplicationJobContext,
  profile: ApplicationProfile | null,
  resume: ResumeStructuredData | null
): string {
  const submitPolicy = isUnsafeFullAutomation()
    ? `- **Full automation (unsafe — BROWSER_APPLY_UNSAFE_FULL_AUTOMATION=1):** When the application is truthful and complete for **this job**, you MAY click final **Submit / Send application / Apply** and, if clearly required for this posting, **Sign up / Register / Create account**. Never affirm legal or background checks falsely.`
    : `- Do not click submit/send/apply-final buttons; only prepare the form.`

  const signupClickPolicy = isUnsafeFullAutomation()
    ? `- **Account / signup gates:** You may **fill** and, when required to finish this job's flow, **click** name/email/password/sign-up actions using the resume + profile + portal section below — only for obvious host-board gates tied to this application. Still **never** use **Google / Apple / Microsoft / GitHub / LinkedIn OAuth** buttons — automation cannot complete federated login.`
    : `- **Account / signup gates:** You may **fill** name, email, phone, and password fields from the resume + profile + portal section below when the UI is clearly creating or recovering a **host board** account before the employer form. After filling email on a gate modal, **click** step buttons such as **Continue with email**, **Continue**, **Next**, **Log in**, or **Sign in** when they clearly advance the same flow. Do **not** click the final **Register** / **Create account** / **Sign up** completion or any **Submit application** / **Send** — those stay for human review.
- **No federated login:** Never click **Continue with Google**, **Continue with Apple**, **Sign in with Microsoft**, **Log in with LinkedIn**, or any OAuth / SSO control — automation cannot pass third-party identity pages. Stay on the **host site's email or password** path only.`

  const policies = `
## Policies (follow strictly)
- Be truthful. Never invent employers, degrees, certifications, or skills that are not supported by the resume or profile.
- **Identity (name / email):** If the **Application profile** section lists legal name and application email, use those for signup and application identity fields. Otherwise use the resume name and email.
- Work authorization / sponsorship: if a yes/no or choice question is about visa sponsorship, answer **Yes** only if the profile says they require sponsorship; otherwise **No**.
- Location / relocation: answer from profile country, city, and state — do not guess a country.
- Salary: use profile salary expectation when relevant; if the form asks EUR gross per year and the profile figure is USD, give a plausible EUR integer (no symbols).
- Equal employment / demographic questions: if optional or "decline to state", prefer declining or "Prefer not to say" when that option exists; never fabricate protected attributes.
${submitPolicy}
- **Most links are not the application:** Job pages are full of **site chrome** (footer, blog, other jobs, marketing). The DOM scan will include many **hint "link"** rows — treat most as noise. Prefer clicks whose **visible text**, **aria-label**, or **href** clearly advances **this job's apply path** (e.g. Apply, Easy Apply, Start application, Sign in to apply, Continue toward the form). Avoid generic site search, newsletter, or unrelated listings unless they are obviously the apply mechanism for this posting.
- **Navigation before fills:** Expect **multi-step** flows (modals, new routes, sign-in walls). Plan **click** steps first to expose the real form; only then fill fields.
- **Navigation:** The planner may output **click** steps on links or buttons (e.g. Apply, Continue, Sign in) to expose hidden forms, modals, or the next step — infer from scan labels, hints, and href text; there are no per-site hardcoded selectors in code.
${signupClickPolicy}
- Cover letter / free-text: write concise, role-specific prose (2–4 short paragraphs max unless the field clearly wants more).
- Technology / stack questions: one cohesive paragraph grounded in the resume skills and experience; avoid a single generic sentence.
`.trim()

  const jobBlock = `
## Job
- Title: ${job.title}
- Company: ${job.company}
${job.description ? `- Notes / description excerpt:\n${job.description.slice(0, 4000)}` : ''}
`.trim()

  const profileBlock = profile
    ? `
## Application profile (structured account data)
${[
  profile.applicationFullName && `- Legal name (applications / signup): ${profile.applicationFullName}`,
  profile.applicationEmail && `- Application email: ${profile.applicationEmail}`,
  profile.phone && `- Phone: ${profile.phone}`,
  [profile.city, profile.state, profile.country].filter(Boolean).length &&
    `- Location: ${[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}`,
  profile.linkedinUrl && `- LinkedIn: ${profile.linkedinUrl}`,
  profile.githubUrl && `- GitHub: ${profile.githubUrl}`,
  profile.portfolioUrl && `- Portfolio: ${profile.portfolioUrl}`,
  profile.workAuthorization && `- Work authorization (code): ${profile.workAuthorization}`,
  `- Requires visa sponsorship: ${profile.requiresSponsorship ? 'Yes' : 'No'}`,
  profile.salaryExpectation != null &&
    `- Salary expectation (annual, as stored in profile — treat as candidate’s target): ${profile.salaryExpectation}`,
  profile.noticePeriod && `- Notice period: ${profile.noticePeriod}`,
  profile.yearsExperience != null && `- Years of experience (as stored): ${profile.yearsExperience}`,
]
  .filter(Boolean)
  .join('\n')}
`.trim()
    : '## Application profile\n(none on file — rely on resume only)'

  const resumeBlock = resume
    ? `
## Resume (structured)
- Name: ${resume.name}
- Email: ${resume.email}
${resume.phone ? `- Phone: ${resume.phone}` : ''}
${resume.location ? `- Location: ${resume.location}` : ''}
${resume.linkedin ? `- LinkedIn: ${resume.linkedin}` : ''}
${resume.github ? `- GitHub: ${resume.github}` : ''}
${resume.portfolio ? `- Portfolio: ${resume.portfolio}` : ''}
${resume.summary ? `- Summary:\n${resume.summary}` : ''}
- Skills: ${resume.skills.join(', ')}
${resume.languages?.length ? `- Languages: ${resume.languages.join(', ')}` : ''}
- Experience:\n${resume.experience
        .slice(0, 8)
        .map(
          (e) =>
            `  - ${e.title} at ${e.company} (${e.startDate}–${e.endDate}): ${e.description.slice(0, 500)}`
        )
        .join('\n')}
- Education:\n${resume.education.map((e) => `  - ${e.degree}, ${e.institution}`).join('\n')}
`.trim()
    : '## Resume\n(none parsed — fill only from profile where possible)'

  const portal = portalSignupCredentialsBlock(profile)
  return [policies, jobBlock, profileBlock, resumeBlock, portal].filter(Boolean).join('\n\n')
}
