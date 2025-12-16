# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Job Application Tracker** - A low-friction job application tracker that automatically stays up to date by combining job URL capture with email-based status detection. Users never maintain a spreadsheet again.

**Full Product Spec**: See `/apptracker.md` for complete product requirements, user flows, and implementation phases.

This is a Next.js 16 application (`my-app/`) built with the App Router architecture, TypeScript, React 19, and TailwindCSS 4.

## Product Principles

1. **Zero busywork** - Email + automation should do the work, not manual status updates
2. **Fast capture** - Saving a job takes one click or one pasted URL
3. **Calm UX** - No PM-tool complexity, few concepts, obvious defaults

## Technology Stack

### Current
- **Bun** - Package manager and runtime (use `bun` commands, not `npm`)
- **Next.js 16.0.10** - Full-stack React framework using App Router
- **React 19.2.1** - Latest React with concurrent features
- **TypeScript 5** - Type-safe JavaScript
- **TailwindCSS 4** - Utility-first CSS framework with PostCSS integration
- **React Compiler** - Enabled for automatic React optimizations (babel-plugin-react-compiler)

### To Add
- **Postgres (Supabase)** - Database
- **Prisma** - ORM
- **Supabase Auth or NextAuth** - Authentication
- **Supabase Edge Functions or Vercel Cron** - Background jobs for email ingestion

## Development Commands

All commands should be run from the `my-app/` directory using **Bun**:

```bash
bun dev              # Start development server (http://localhost:3000)
bun run build        # Build for production
bun start            # Start production server
bun lint             # Run ESLint (uses eslint.config.mjs)
bun install          # Install dependencies
```

## Project Structure

```
my-app/
├── src/app/              # Next.js App Router directory
│   ├── layout.tsx        # Root layout with Geist fonts
│   ├── page.tsx          # Home page
│   ├── globals.css       # Global styles with Tailwind and CSS variables
│   └── favicon.ico       # App favicon
├── public/               # Static assets
├── next.config.ts        # Next.js configuration (TypeScript)
├── tsconfig.json         # TypeScript configuration with path aliases
├── eslint.config.mjs     # ESLint 9 flat config
├── postcss.config.mjs    # PostCSS with TailwindCSS 4 plugin
└── package.json          # Dependencies and scripts
```

## Key Configuration Details

### TypeScript Path Aliases
- `@/*` maps to `./src/*` (configured in tsconfig.json:22)
- Use `@/app/...` to import from src/app directory

### Next.js Configuration
- React Compiler is enabled (next.config.ts:5)
- This optimizes React components automatically

### TailwindCSS 4 Setup
- Uses new `@import "tailwindcss"` syntax (globals.css:1)
- Custom theme configured inline with `@theme` directive (globals.css:8-13)
- CSS variables for theming: `--background`, `--foreground`, `--font-sans`, `--font-mono`
- Dark mode support via `prefers-color-scheme` media query

### Fonts
- Geist Sans and Geist Mono loaded via next/font/google
- Font variables applied in root layout and available in CSS as CSS variables

### ESLint
- Uses ESLint 9 flat config format (eslint.config.mjs)
- Includes Next.js recommended rules (core-web-vitals and TypeScript)
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

## Architecture Notes

### App Router Structure
- All pages and routes go in `src/app/`
- Follows Next.js 13+ App Router conventions
- Server components by default (use "use client" directive when needed)

### Styling Approach
- TailwindCSS 4 with inline theme configuration
- CSS variables for dynamic theming
- Dark mode automatically responds to system preference

## Application Structure

### Planned Routes
- `/` - Landing/dashboard
- `/today` - What needs attention today (overdue, due today, due in 7 days)
- `/board` - Kanban view (SAVED → APPLIED → INTERVIEW → OFFER → REJECTED → GHOSTED)
- `/jobs` - High-density table view with sort/filter
- `/jobs/new-url` - Paste job URL to scrape and save
- `/jobs/:id` - Job detail with timeline and notes
- `/settings/integrations` - Gmail OAuth connection

### API Routes
- `POST /api/scrape-job` - Fetch and parse job URL
- `POST /api/jobs/from-extension` - Browser extension endpoint (Phase 3)
- Background cron/worker for email ingestion

## Data Model (Prisma)

### Core Models
- **Job** - Job posting with status (SAVED, APPLIED, INTERVIEW, OFFER, REJECTED, GHOSTED)
  - Includes: title, company, location, source, url, priority (A/B/C), dates, nextAction, tags, notes, salary, contact info
- **Activity** - Timeline events (NOTE, STATUS_CHANGE, EMAIL_UPDATE, INTERVIEW, REJECTION, OFFER)
  - Tracks status transitions and email-triggered updates
- **EmailIntegration** - Gmail OAuth tokens and sync state
  - Stores accessToken, refreshToken, lastSyncedAt

See `apptracker.md` (lines 277-345) for complete schema definitions.

## Implementation Phases

### Phase 1 - Manual + URL Capture (MVP)
- Job + Activity models with Prisma
- URL scraping (POST /api/scrape-job)
- Basic CRUD for jobs
- Views: /today, /board, /jobs, /jobs/:id

### Phase 2 - Email Sync (Key Differentiator)
- Gmail OAuth integration
- Background email ingestion (cron/worker)
- Rule-based email classification (ATS domains, keywords)
- Automatic status updates and timeline events
- Optional: AI-based classification for edge cases

### Phase 3 - Browser Extension
- Chrome extension with auth
- One-click job save from any job page
- Idempotent job creation by URL

## Development Guidelines

### Code Philosophy
- **Simplicity over completeness** - Fewer features, fewer settings, fewer screens
- **Automation first** - Infer from email/URLs instead of requiring manual input
- **Incremental delivery** - Build MVP first, extensible architecture later

### Email Parsing Strategy
- **Rules first, AI second** - Use deterministic rules where possible
- **AI for edge cases** - When needed, use structured JSON output
- **Never overwrite user edits** - Only update status when advancement is explicit

### Explicit Non-Goals
- Resume or cover letter generation
- Analytics dashboards
- Multi-user collaboration
- Recruiter-style pipelines
