# Trackd

Trackd is an AI-powered job-search workspace for managing applications, syncing recruiting emails, improving resumes, practicing interviews, and discovering opportunities with automated job-search agents.

It is designed as a personal job-search command center: users can save roles, track application status, organize follow-ups, import updates from email, evaluate job fit with AI, and keep a searchable history of their job hunt.

---

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

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Base UI
- Framer Motion

### Backend / Infrastructure

- Prisma 7
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Vercel

### AI / Automation

- OpenAI
- IMAP + Mailparser
- Puppeteer
- Playwright
- Cheerio

### Testing

- Vitest
- Coverage via `@vitest/coverage-v8`

---

## Architecture Overview

Trackd is built around a Next.js App Router architecture with Prisma/Postgres persistence, Supabase authentication/storage, AI workflows, and automation scripts.

Core modules include:

- job tracking and activity timelines
- email sync and parsing
- AI resume workflows
- interview practice sessions
- automated job discovery bots
- notification infrastructure
- browser-extension integration
- auto-apply scaffolding

The Prisma schema acts as the core source of truth for product structure and workflow relationships.

---

## Getting Started

### Install dependencies

```bash
npm install
```

### Generate Prisma client

```bash
npx prisma generate
```

### Run the development server

```bash
npm run dev
```

The development server runs on:

```bash
http://localhost:3001
```

---

## Environment Variables

Create a `.env.local` file.

Typical variables include:

```env
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
RESEND_API_KEY=
```

Note: exact variables may evolve as integrations expand.

---

## Testing

### Run all tests

```bash
npm run test
```

### Run focused tests

```bash
npm run test:classifier
npm run test:matching
npm run test:sync
```

### Bot testing

Dry-run bot execution:

```bash
npm run test:bot:dry
```

Replay bot snapshots:

```bash
npm run test:bot:replay
```

### Auto-apply testing

```bash
npm run test:auto-apply
```

---

## Scripts

Useful scripts included in the repo:

```bash
npm run debug:sync
npm run test:live
npm run test:bot
npm run bot:us-report
npm run reset:jobs
npm run export:apply-storage
```

---

## Product Direction

Trackd aims to become a unified AI job-search operating system:

- track every opportunity
- centralize recruiting communication
- improve resumes and interview readiness
- automate discovery workflows
- reduce repetitive application work
- maintain visibility across the entire job-search lifecycle

---

## Security Notes

Trackd handles sensitive user information such as:

- resumes
- recruiting emails
- application history
- contact information
- authentication credentials
- application workflow data

Production deployments should verify:

- credential encryption
- strict user-level database scoping
- safe logging practices
- secure handling of third-party integrations
- privacy protections for uploaded files and email content

---

## Roadmap Ideas

- Gmail and Microsoft OAuth support
- advanced AI job-fit reasoning
- calendar sync for interviews
- richer analytics/dashboard insights
- collaborative recruiter workflows
- production-grade ATS auto-apply pipelines
- browser-extension expansion
- smarter recommendation systems

---

## Status

Trackd is currently an active, evolving product and experimentation platform focused on AI-assisted job-search workflows and automation.
