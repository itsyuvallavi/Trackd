# Trackd Repo Review + Handoff for Another Agent

Generated for: Yuval Lavi  
Repo: `itsyuvallavi/Trackd`  
Purpose: give another AI/code agent enough context to understand, review, improve, and polish Trackd without needing the original chat history.

---

## 1. Executive Summary

Trackd is not just a simple job tracker. Based on the repository metadata and schema, it is a fairly ambitious AI-powered job-search operating system built with Next.js, React, Prisma/Postgres, Supabase Auth/Storage, OpenAI, email parsing, browser automation, and bot-driven job discovery.

The product appears to combine:

- user authentication and profile creation through Supabase
- job application tracking
- job activity timelines
- email sync and email-derived application updates
- AI classification/matching logic
- resume upload, parsing, and improvement flows
- interview practice sessions with AI feedback
- automated job-search bot configuration and run logs
- imported/dismissed job deduplication
- browser extension API keys
- feedback collection from both web and extension surfaces
- early auto-apply / ATS automation scaffolding

The strongest thing about the repo is product ambition: this is portfolio-worthy because it shows a full-stack product with real data modeling, auth, integrations, background/bot concepts, and AI-assisted workflows.

The biggest weaknesses are presentation, documentation, architecture clarity, and likely portfolio framing. The current `README.md` is still the default create-next-app README. That undersells the project heavily. A reviewer/recruiter landing on the repo would not understand the real scope unless they inspect package scripts and Prisma schema.

---

## 2. Confirmed Tech Stack

From `package.json`, the project uses:

### Framework / App

- Next.js `^16.2.3`
- React `19.2.1`
- React DOM `19.2.1`
- TypeScript `^5`
- App Router style files under `src/app`

### Styling / UI

- Tailwind CSS `^4`
- shadcn `^3.6.2`
- `@base-ui/react`
- `lucide-react`
- `@tabler/icons-react`
- `framer-motion`
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`

### Backend / Database / Auth

- Prisma `^7.7.0`
- `@prisma/client`
- `@prisma/adapter-pg`
- PostgreSQL via `pg`
- Supabase SSR and Supabase JS

### AI / Automation / Data Extraction

- `openai ^6.15.0`
- `mailparser`
- `imap`
- `cheerio`
- `puppeteer`
- `playwright-core`
- `adm-zip`
- `xlsx`
- `zod`
- `resend`

### Testing / Scripts

- Vitest
- coverage via `@vitest/coverage-v8`
- many specific scripts for email sync, bot search, snapshots, auto-apply testing, and exporting Indeed storage state

Important scripts from `package.json`:

```json
"dev": "next dev -p 3001 --hostname 0.0.0.0",
"build": "prisma generate && next build",
"postinstall": "prisma generate",
"test": "vitest run",
"test:classifier": "vitest run src/__tests__/email-classifier.test.ts",
"test:matching": "vitest run src/__tests__/job-matching.test.ts",
"test:sync": "vitest run src/__tests__/sync-flow.test.ts",
"debug:sync": "bun run src/scripts/debug-email-sync.ts",
"test:live": "bun run src/scripts/test-email-sync-live.ts",
"test:bot": "bun run scripts/test-bot-search.ts",
"test:bot:dry": "bun run scripts/test-bot-search.ts --dry-run",
"test:bot:snap": "bun run scripts/test-bot-search.ts --dry-run --save-snapshot",
"test:bot:replay": "bun run scripts/test-bot-search.ts --dry-run --from-snapshot",
"bot:us-report": "bun run scripts/bot-jobs-us-report.ts",
"reset:jobs": "bun run scripts/wipe-user-job-data.ts",
"test:auto-apply": "bun run scripts/test-auto-apply-local.ts",
"export:apply-storage": "tsx scripts/export-indeed-storage-state.ts"
```

Takeaway: The repo already has test and automation hooks. The next agent should not treat this as a toy CRUD app.

---

## 3. Product Understanding

Trackd appears to be a job-search management platform for candidates who want to centralize and automate their application workflow.

A concise product description:

> Trackd is an AI-powered job-search workspace that helps users save jobs, track application status, sync relevant recruiting emails, generate/improve resumes, practice interviews, and run automated job-search bots that score and import opportunities.

Possible positioning:

> A personal CRM for job hunting, enhanced with AI and automation.

More technical positioning:

> A full-stack Next.js application that combines Supabase auth, Prisma/Postgres, OpenAI, IMAP email parsing, job-bot automation, resume intelligence, and application tracking into a unified job-search dashboard.

---

## 4. Important Data Model Review

The Prisma schema is the clearest map of the product.

### 4.1 User/Profile

`Profile` stores:

- `id` matching Supabase `auth.users.id`
- `email`
- optional `name`
- optional `avatarUrl`
- timestamps

Auth logic in `src/lib/auth.ts` ensures a profile row exists when authenticated users hit protected routes. This is a good design choice because it avoids relying only on database triggers and keeps the app resilient.

### 4.2 Core Job Tracking

`Job` includes:

- user ownership: `userId`
- core fields: title, company, location, source, URL
- workflow fields: status, priority, saved/applied/interview dates, next action
- metadata: tags, notes, salary, contact name/email
- AI/bot content: cover letter, bot score, bot reasoning
- import metadata: `importSource`, `importJobBoard`
- relations to activities and interview sessions

Enums:

- `JobSource`: manual, LinkedIn, Indeed, company site, referral, recruiter, bot, etc.
- `JobStatus`: saved, applied, interview, offer, rejected, archived
- `JobPriority`: A, B, C

This is strong for a dashboard/product demo because it maps to real job-search behavior.

### 4.3 Activity Timeline

`Activity` stores job-related events:

- notes
- status changes
- email updates
- interviews
- rejections
- offers

This is a good abstraction. It allows each job to have a history rather than only storing its current state.

### 4.4 Email Integration

`EmailIntegration` supports:

- IMAP now
- Gmail OAuth and Microsoft OAuth as future provider options
- encrypted IMAP credential fields
- active/inactive status
- last sync time
- last error
- auto-sync scheduling fields

`EmailSyncLog` stores detailed sync metrics:

- started/completed timing
- source: manual, auto, cron
- total/processed/skipped emails
- exact/fuzzy/ambiguous matches
- new jobs detected
- jobs updated
- notifications created
- error message and details

This is one of the most impressive parts of the app because it shows thinking beyond a basic CRUD interface. It suggests the app can ingest incoming job-related email and update job records automatically.

### 4.5 Notifications

`Notification` supports:

- ambiguous email matches
- new job detected
- job updated
- sync complete
- sync error

This pairs nicely with email sync and bot automation.

### 4.6 Interview Practice

`InterviewSession` and `InterviewMessage` support:

- sessions linked optionally to a job
- interview type: technical, general, mixed
- session state: in-progress, completed, abandoned
- AI summary
- strengths, improvements, tips
- message history
- feedback metadata
- optional audio URL

This makes Trackd broader than a job tracker. It includes prep and coaching.

### 4.7 Resume Workflows

`ResumeSession` and `ResumeMessage` support:

- uploaded resume file URL/name/type
- extracted resume text
- improved resume text
- parsed resume JSON
- OpenAI file/assistant/thread IDs
- chat-like message history

This indicates a resume improvement assistant that likely uses OpenAI Assistants or file upload flows.

### 4.8 Bot Automation

`BotConfig` supports:

- keywords
- locations
- excluded companies
- excluded keywords
- spoken languages
- remote-only setting
- experience level
- salary minimum
- schedule/frequency
- Telegram chat ID
- minimum score threshold

`BotResume` supports multiple resumes for different target roles, including default resumes and keyword matching.

`BotRun`, `BotRunLog`, and `BotRunListing` support:

- run lifecycle
- run source: cron/manual
- jobs found/new/evaluated/approved
- errors and search metadata
- ordered logs
- per-listing evaluation metadata such as score, flags, reasoning, resume match, decision reason

This is very strong. It shows that the bot has observability, not just a one-off scrape.

### 4.9 Application / Auto-Apply Scaffolding

`ApplicationProfile` stores application form data:

- full name/email
- portal signup password
- phone/address/city/state/country
- LinkedIn/GitHub/portfolio
- work authorization and sponsorship
- salary expectation
- notice period
- years of experience

`ApplicationAttempt` stores:

- job ID
- ATS type
- status
- form data
- screenshots
- error message
- submitted timestamp

This strongly suggests planned or partially implemented browser/ATS auto-apply functionality.

### 4.10 Feedback

`Feedback` stores:

- optional user ID/email
- type: error, bug, feature request, other
- source: web or extension
- title/description
- URL
- user agent
- metadata
- status

This is useful for a live product because it allows feedback from the web app and browser extension.

---

## 5. Architecture Notes

### 5.1 Auth

`src/lib/auth.ts` uses Supabase server auth and Prisma profile creation.

Strengths:

- `getCurrentUser` is wrapped with React `cache()` to deduplicate auth checks within a request.
- `requireAuth` redirects unauthenticated users to `/login`.
- `ensureProfileExists` creates the app-level profile row if missing.
- Uses `unstable_cache` and cache tags for profile existence checks.

Possible concern:

- Because profile creation is non-blocking on error, downstream routes need to handle cases where a Supabase user exists but Prisma profile creation failed.
- Deleting orphaned profiles by email may be useful, but the next agent should verify it cannot accidentally delete legitimate data in multi-auth-account edge cases.

### 5.2 Prisma / DB Connection

`src/lib/prisma.ts` uses Prisma with `@prisma/adapter-pg` and a global `pg.Pool`.

Strengths:

- Uses global client/pool to avoid connection explosion in dev/hot reload.
- Sets `max: 10` and `min: 2`.
- Adds graceful shutdown handlers.
- Uses Prisma log config based on environment.

Potential concerns:

- `process.env.DATABASE_URL!` is assumed to exist. A clearer startup error could improve DX.
- `min: 2` may be undesirable in serverless/edge-ish environments depending on deployment target.
- Adding signal handlers inside a module can be okay in Node runtime, but verify compatibility with Next deployment target.

### 5.3 Landing Page / UI Direction

`src/app/page.tsx` shows:

- unauthenticated home page
- redirects authenticated users to `/jobs`
- dark glass/aurora style
- Trackd branding
- login form
- hero image
- feature pills: email sync, interviews/offers/follow-ups, AI resume advisor

This is a good visual/product direction. It frames Trackd as polished and AI-powered.

Potential issue:

- The line “Trusted by thousands of job-seekers. End-to-end encrypted.” should only remain if true. If this is a portfolio/demo product, it is better to replace with something honest like:
  - “Your private workspace for tracking every opportunity.”
  - “Built for focused, organized job search workflows.”
  - “Track applications, emails, resumes, and interviews in one place.”

---

## 6. Major Strengths

### 6.1 Strong Full-Stack Scope

This repo demonstrates far more than UI. It includes auth, data modeling, AI, email parsing, automation, logging, testing scripts, and browser automation dependencies.

### 6.2 Real Product Thinking

The schema reflects real user workflows:

- job status tracking
- activities
- email updates
- ambiguous match notifications
- resume sessions
- interview sessions
- bot runs and logs
- dismissed imports to prevent duplicate resurfacing

### 6.3 Good Use of Observability Concepts

`EmailSyncLog`, `BotRun`, `BotRunLog`, and `BotRunListing` are important. They show the system records what happened, not just final results. This makes debugging and UX much better.

### 6.4 Portfolio Value

For a resume/portfolio, Trackd can show:

- Next.js app architecture
- Prisma schema design
- Supabase auth integration
- AI-assisted workflows
- job matching and automation logic
- testable scripts
- browser automation with Playwright/Puppeteer
- email sync and parsing
- product UI/UX design

This should absolutely be listed under project experience, especially if framed well.

---

## 7. Major Weaknesses / Risks

### 7.1 README Is Still Default

This is the highest-priority polish issue.

The README currently describes a generic Next.js starter. That makes the project look unfinished even though the codebase has serious functionality.

The next agent should replace it with a real README that includes:

- product summary
- feature list
- tech stack
- architecture overview
- screenshots or demo GIFs
- setup instructions
- environment variables
- database setup
- test scripts
- roadmap
- security/privacy notes
- known limitations

### 7.2 Product Surface May Be Too Broad

The app includes job tracking, email sync, resume assistant, interview practice, bot search, extension, and auto-apply. This is impressive but risks feeling unfocused.

Recommendation: frame Trackd around one core promise:

> AI job-search command center.

Then organize features as modules:

1. Track jobs
2. Sync emails
3. Improve resumes
4. Practice interviews
5. Discover jobs with bot automation
6. Prepare for auto-apply workflows

### 7.3 Security/Privacy Needs Clear Handling

The app touches sensitive data:

- resumes
- job-search history
- emails
- IMAP credentials
- OAuth tokens
- application passwords
- portal signup password
- personal address/phone
- work authorization

The next agent should audit:

- credential encryption implementation
- whether secrets are ever logged
- whether email body content is stored or only metadata
- whether OpenAI calls send sensitive data unnecessarily
- whether database access is always scoped by `userId`
- whether extension keys are hashed and never returned after creation
- whether auto-apply screenshots may contain private info

### 7.4 Potential Runtime Compatibility Issues

The dependency set includes Next.js, Prisma, `pg`, `imap`, `puppeteer`, `playwright-core`, and mail parsing. These likely require Node runtime, not Edge runtime.

The next agent should verify all API routes using Node-only libraries explicitly set Node runtime if needed:

```ts
export const runtime = 'nodejs'
```

### 7.5 Testing Strategy Needs Visibility

There are useful scripts, but the README does not explain what they test or how to run them safely.

The next agent should document:

- unit tests vs live tests
- dry-run bot tests
- snapshot bot replay tests
- email sync debug/test modes
- auto-apply local test requirements

### 7.6 Naming / Branding

`package.json` name is still `my-app`. Rename to something like:

```json
"name": "trackd"
```

This is a small but important professional polish issue.

---

## 8. Recommended Next-Agent Tasks

### Task A — Create a Real README

Replace the default README with a complete one.

Suggested README structure:

```md
# Trackd

AI-powered job-search workspace for tracking applications, syncing recruiting emails, improving resumes, practicing interviews, and discovering opportunities with automated job-search agents.

## Features

## Tech Stack

## Architecture

## Data Model Overview

## Getting Started

## Environment Variables

## Database Setup

## Running Tests

## Bot / Automation Scripts

## Security Notes

## Roadmap
```

### Task B — Add `.env.example`

Create an `.env.example` with placeholder values for likely required variables:

```env
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
RESEND_API_KEY=
ENCRYPTION_KEY=
TELEGRAM_BOT_TOKEN=
```

The agent must inspect the repo for exact env variable names before finalizing.

### Task C — Rename Package

Change package name from `my-app` to `trackd`.

### Task D — Add Architecture Docs

Create docs like:

- `docs/architecture.md`
- `docs/email-sync.md`
- `docs/bot-search.md`
- `docs/security.md`

### Task E — Add Product Screenshots / Demo Instructions

If screenshots exist, add them to README. If not, create a `docs/screenshots.md` placeholder and list which screenshots to capture:

- landing/login
- jobs dashboard
- job detail/activity timeline
- email sync page
- resume assistant
- interview practice
- bot config and run logs

### Task F — Audit Sensitive Data Handling

Search for:

- `imapPassword`
- `accessToken`
- `refreshToken`
- `portalSignupPassword`
- `OPENAI_API_KEY`
- `console.log`
- `metadata`
- `email.body`
- `rawText`

Check whether secrets or sensitive user data can leak into logs, bot run logs, notifications, screenshots, or client props.

### Task G — Verify User Scoping

Every query for jobs, activities, notifications, resumes, bot config, runs, feedback, extension keys, and application attempts must scope by `userId` where user data is involved.

### Task H — Add Demo Mode / Seed Data

For portfolio review, add seed/demo data so another person can run the app locally and see the product without connecting real email.

Potential script:

```bash
bun run scripts/seed-demo-user.ts
```

### Task I — Clarify Live vs Dry-Run Automation

The bot and auto-apply scripts should default to dry-run behavior unless explicitly confirmed through environment variables or CLI flags.

---

## 9. Resume / Portfolio Framing for Yuval

Trackd is a strong project for a web-dev/AI-app resume if described properly.

Possible resume bullet options:

- Built Trackd, an AI-powered job-search workspace using Next.js, React, TypeScript, Prisma, PostgreSQL, Supabase Auth, and OpenAI.
- Designed a full relational data model for job tracking, email sync logs, AI resume sessions, interview practice, bot search runs, notifications, extension keys, and auto-apply attempts.
- Implemented architecture for automated job discovery with configurable search preferences, AI scoring thresholds, resume matching, run logs, and duplicate/dismissed-job handling.
- Developed email-sync infrastructure using IMAP/mail parsing to classify recruiting emails, match them to job records, detect new opportunities, and create user notifications.
- Integrated AI-assisted workflows for resume improvement, interview practice, cover-letter generation, and job-fit scoring.
- Added test and debug scripts for classifier behavior, job matching, sync flows, bot dry-runs, snapshot replay, and auto-apply testing.

Shorter portfolio description:

> Trackd is an AI-powered job-search CRM that tracks applications, syncs recruiting emails, improves resumes, practices interviews, and runs automated job-search bots. Built with Next.js, React, TypeScript, Prisma/Postgres, Supabase, OpenAI, IMAP parsing, and browser automation tooling.

---

## 10. Suggested README Draft

The next agent can adapt this directly.

```md
# Trackd

Trackd is an AI-powered job-search workspace for managing applications, syncing recruiting emails, improving resumes, practicing interviews, and discovering new opportunities with automated job-search agents.

It is designed as a personal job-search command center: users can save roles, track application status, organize follow-ups, import updates from email, evaluate job fit with AI, and keep a searchable history of their job hunt.

## Features

### Job Tracking

- Save jobs with title, company, location, source, URL, salary, tags, notes, and priority
- Track status across saved, applied, interview, offer, rejected, and archived stages
- Record job-specific activities such as notes, status changes, email updates, interviews, rejections, and offers
- Store follow-up actions and interview dates

### Email Sync

- Connect an email inbox through IMAP
- Parse recruiting/application emails
- Match emails to existing jobs using exact/fuzzy matching
- Detect ambiguous matches and create notifications
- Record sync logs with processed/skipped counts, match results, updates, errors, and duration

### AI Resume Assistant

- Upload resumes to Supabase Storage
- Extract and cache resume text/structured data
- Improve resume content through AI-assisted sessions
- Keep resume conversation history and OpenAI assistant/thread metadata

### Interview Practice

- Create interview practice sessions linked to a job or general preparation
- Support technical, general, and mixed interview modes
- Store conversation messages and feedback metadata
- Generate summaries, strengths, improvement areas, and personalized tips

### Automated Job Search Bot

- Configure target roles, locations, language requirements, remote preferences, salary minimum, and exclusion rules
- Run manual or scheduled bot searches
- Score jobs with AI and apply a minimum score threshold
- Store run logs, listing-level outcomes, reasoning, flags, and resume-match data
- Avoid re-importing dismissed jobs through fingerprint tracking

### Extension / Feedback / Auto-Apply Foundations

- Generate hashed extension keys for browser-extension access
- Collect user feedback from web and extension surfaces
- Store application profile data for ATS/application automation
- Track application attempts, form data, screenshots, errors, and submission status

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui and Base UI
- Prisma 7
- PostgreSQL
- Supabase Auth and Storage
- OpenAI
- IMAP and Mailparser
- Puppeteer / Playwright tooling
- Vitest

## Getting Started

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run the development server:

```bash
npm run dev
```

The dev server runs on:

```bash
http://localhost:3001
```

## Testing

Run all tests:

```bash
npm run test
```

Run focused tests:

```bash
npm run test:classifier
npm run test:matching
npm run test:sync
```

Run bot dry-run tests:

```bash
npm run test:bot:dry
```

Replay bot snapshot tests:

```bash
npm run test:bot:replay
```

## Notes

Trackd handles sensitive user data such as resumes, emails, application history, and application profile details. Production usage should verify encryption, logging, user-level scoping, and third-party API data handling before launch.
```

---

## 11. Suggested Architecture Doc Draft

```md
# Trackd Architecture

Trackd is organized around a Next.js application with server-side auth, Prisma/Postgres persistence, Supabase integration, AI workflows, and automation scripts.

## Core Modules

### Auth

Supabase handles authentication. Server-side helpers read the current Supabase user and ensure a corresponding Prisma `Profile` row exists.

### Jobs

The `Job` model is the central object. Jobs belong to a user and store application status, priority, source, notes, tags, contact info, bot score/reasoning, and import metadata.

### Activities

The `Activity` model records the history of a job: notes, status transitions, email-derived updates, interview events, rejections, and offers.

### Email Sync

Email integration stores provider settings and sync state. Sync logs record processing outcomes for observability and debugging. Notifications surface ambiguous matches, detected jobs, job updates, and sync errors.

### AI Resume Sessions

Resume sessions track uploaded files, extracted text, improved content, parsed JSON, and OpenAI assistant/thread IDs. Resume messages store the conversation history.

### Interview Practice

Interview sessions store a mock interview flow and post-session AI feedback. Messages preserve the conversation and optional feedback metadata.

### Bot Search

Bot config defines the user’s search preferences. Bot runs store execution metadata and counts. Bot listings preserve per-job evaluation results, scores, flags, reasoning, and decision metadata.

### Application Automation

Application profile stores reusable form answers. Application attempts track ATS automation state, submitted forms, screenshots, errors, and results.

## Key Concerns

- Every user-owned query must be scoped by `userId`.
- Any route using Node-only libraries must run in Node runtime.
- Credentials and tokens must be encrypted or hashed as appropriate.
- Logs must avoid leaking email bodies, resume content, tokens, passwords, or personal application data.
```

---

## 12. Priority Order for Next Work

1. Replace README with real product/technical README.
2. Rename package from `my-app` to `trackd`.
3. Add `.env.example` after scanning exact env usage.
4. Add architecture/security docs.
5. Audit sensitive data handling.
6. Audit user scoping in all server/API/database queries.
7. Add screenshots/demo video/GIFs.
8. Add demo seed flow.
9. Clarify bot/auto-apply dry-run safety.
10. Polish landing page honesty and marketing copy.

---

## 13. Instruction to the Next Agent

You are reviewing and improving Trackd, a Next.js/TypeScript AI job-search workspace. Do not treat it as a generic starter app. The codebase already contains a large product surface: job tracking, email sync, AI resume sessions, interview sessions, bot search, extension keys, feedback, and auto-apply scaffolding.

Your first priority is presentation and repo professionalism: replace the default README, add documentation, rename the package, add `.env.example`, and make the repository understandable to a recruiter or technical reviewer.

Your second priority is safety and correctness: audit secret handling, personal data handling, userId scoping, runtime compatibility, and automation dry-run behavior.

Your third priority is developer experience: document setup, tests, scripts, and demo data.

Be careful not to delete product functionality. Preserve the existing architecture unless you find a concrete bug or security issue. Prefer incremental improvements with clear commits.
