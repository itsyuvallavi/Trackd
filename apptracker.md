Job Application Tracker

Product & Technical Specification

One-Sentence Summary

A low-friction job application tracker that automatically stays up to date by combining job URL capture (or browser extension) with email-based status detection—so users never maintain a spreadsheet again.

Product Principles (Non-Negotiable)

Zero busywork

Users should not manually update statuses unless they want to.

Email + automation should do the work.

Fast capture

Saving a job should take one click or one pasted URL.

No mandatory form filling up front.

Calm UX

No PM-tool complexity.

Few concepts, obvious defaults, minimal configuration.

If a feature violates any of the above, it is out of scope for MVP.

Target User

Individual job seekers applying to dozens or hundreds of roles across:

LinkedIn

Indeed

Greenhouse / Lever / Workday

Random company career pages

They care about:

What they applied to

Current status

What needs attention today

Not mentally tracking rejections or interview logistics

Core Tech Stack (Suggested)

Frontend: Next.js (App Router), TypeScript, Tailwind

Backend: Next.js API routes / server actions

DB: Postgres (Supabase)

ORM: Prisma

Auth: Supabase Auth or NextAuth

Background work: Cron / queue (Supabase Edge Functions, Vercel cron, or similar)

Core User Flows
1. Saving a Job (Primary Entry Point)
Goal

A job posting becomes a structured record with minimal user effort.

Entry Methods
A. Paste Job URL (MVP)

Route

/jobs/new-url


Flow

User pastes a job posting URL.

Clicks Fetch.

Backend scrapes the page and extracts:

title

company

location (best effort)

rawDescription (optional)

UI shows a prefilled confirmation form.

User clicks Save Job.

Backend

POST /api/scrape-job


Responsibilities:

Fetch HTML

Parse metadata (OpenGraph, common job page patterns)

Return extracted fields

Fail gracefully if parsing is partial

Default Behavior

Initial status: SAVED

source: inferred from domain if possible

No required fields beyond title + company

B. Browser Extension (Phase 3)

Flow

User installs Chrome extension and authenticates.

On a job page:

User clicks extension button.

Extension scrapes visible job data.

Sends payload to backend.

Endpoint

POST /api/jobs/from-extension


Behavior

Create or update job by URL (idempotent).

Show “Saved!” confirmation in extension UI.

This flow should mirror tools like Huntr/Eztrackr, but with fewer steps.

2. Automatic Updates via Email (Key Differentiator)
Goal

Once a job exists, its status and timeline update automatically from incoming emails.

A. Email Connection

Route

/settings/integrations


Flow

User clicks Connect Gmail

OAuth grants read-only access

Tokens stored encrypted

Explain clearly:

“We only scan job-related emails to keep your tracker updated.”

B. Email Ingestion

Background Process

Runs periodically (cron / worker)

Fetches new emails since lastSyncedAt

Initial Filters

Known ATS domains:

LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, etc.

Keyword matching:

“application received”

“interview”

“assessment”

“unfortunately”

“regret to inform”

C. Email Classification (Rules First, AI Optional)

For each relevant email:

Determine

Email type:

Application confirmation

Interview invite

Rejection

Offer

Generic update

Company

Role title (best effort)

Dates (interview time, deadlines)

Matching Strategy

Job URL in email body

Thread ID from previous match

Company + title fuzzy match

AI Usage (Optional, Pluggable)

Use LLM only when rules are insufficient

Prompt should output strict JSON:

{
  "type": "INTERVIEW",
  "company": "",
  "title": "",
  "interviewDate": ""
}

D. Job Updates

Status Mapping

Confirmation → APPLIED

Interview invite → INTERVIEW

Rejection → REJECTED

Offer → OFFER

Side Effects

Update lastActivityAt

Append Activity record

Set or clear nextAction:

Interview → “Prepare interview”

Assessment → “Complete assessment”

Rejection → clear actions

Important Rule

Email updates should never overwrite manual user edits unless status advancement is explicit.

Data Model (Prisma-Friendly)
Job
Job {
  id: string
  userId: string

  title: string
  company: string
  location?: string
  source: 'LINKEDIN' | 'INDEED' | 'COMPANY_SITE' | 'OTHER'
  url: string

  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'GHOSTED'
  priority: 'A' | 'B' | 'C'

  appliedAt?: Date
  lastActivityAt?: Date

  nextAction?: string
  nextActionDueAt?: Date

  tags: string[]
  notes?: string

  salaryMin?: number
  salaryMax?: number
  currency?: string

  contactName?: string
  contactEmail?: string

  resumeVersion?: string
  coverLetterUsed?: boolean

  rawDescription?: string

  createdAt: Date
  updatedAt: Date
}

Activity (Timeline)
Activity {
  id: string
  jobId: string
  userId: string

  type:
    | 'NOTE'
    | 'STATUS_CHANGE'
    | 'EMAIL_UPDATE'
    | 'INTERVIEW'
    | 'REJECTION'
    | 'OFFER'

  fromStatus?: Job['status']
  toStatus?: Job['status']

  description: string
  createdAt: Date
}

Email Integration
EmailIntegration {
  id: string
  userId: string
  provider: 'GMAIL'
  accessToken: string
  refreshToken: string
  lastSyncedAt?: Date
}

UI Structure
/today

Single answer to: “What needs my attention?”

Overdue actions

Due today

Due in next 7 days

Quick actions: Done, Snooze

/board

Kanban columns:

SAVED → APPLIED → INTERVIEW → OFFER → REJECTED → GHOSTED

Drag & drop changes status

Lightweight cards (no clutter)

/jobs

High-density table for power users:

Sort

Filter

Inline status edits

/jobs/:id

Header: status, next action

Timeline: activities + email updates

Notes section

/settings/integrations

Gmail connection

Last sync timestamp

Trust & privacy explanation

Implementation Phases
Phase 1 – Manual + URL Capture (MVP)

Job + Activity models

URL scraping

List, board, detail, today views

Phase 2 – Email Sync

Gmail OAuth

Background email ingestion

Rule-based classification

Timeline + status updates

Phase 3 – Browser Extension

Chrome extension

Auth token flow

One-click job save

Explicit Non-Goals (Do Not Build)

Resume or cover letter generation

Analytics dashboards

Multi-user collaboration

Recruiter-style pipelines

Final Product Definition

A self-updating job application tracker that:

Captures jobs instantly from URLs or the browser

Watches your inbox to update statuses automatically

Shows exactly what needs attention today
without turning job searching into another job.