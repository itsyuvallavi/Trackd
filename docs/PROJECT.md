# Trackd — project overview

Trackd is a **job application tracker** for people who want one place to manage roles, status, documents, and follow-ups. It combines manual entry, optional **AI-assisted job search**, **email-driven updates** from your inbox, and tools for **resumes** and **interview practice**. The product is built as a modern **Next.js** app on **PostgreSQL**, with auth tied to **Supabase**.

---

## Tech stack


| Layer                  | Choices                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | [Next.js](https://nextjs.org) 16 (App Router, React Server Components, Server Actions)                                                                                                                           |
| **UI**                 | React 19, [Tailwind CSS](https://tailwindcss.com) 4, [shadcn/ui](https://ui.shadcn.com)–style components, [Lucide](https://lucide.dev) icons, [Framer Motion](https://www.framer.com/motion/) (selective / lazy) |
| **Data**               | [Prisma](https://www.prisma.io) ORM → **PostgreSQL** (e.g. Supabase or any Postgres)                                                                                                                             |
| **Auth**               | [Supabase Auth](https://supabase.com/docs/guides/auth) (`@supabase/ssr`, `@supabase/supabase-js`) — `Profile.id` aligns with `auth.users.id`                                                                     |
| **AI**                 | [OpenAI](https://openai.com) API (job evaluation, resume/chat flows, interview coaching, email classification, etc.)                                                                                             |
| **Email**              | IMAP (`imap`, `mailparser`), optional OAuth fields for Gmail/Microsoft; [Resend](https://resend.com) where applicable                                                                                            |
| **Browser automation** | [Puppeteer](https://pptr.dev), [Playwright](https://playwright.dev) (core) for scraping / apply flows where needed                                                                                               |
| **Other**              | [SWR](https://swr.vercel.app) for client polling/refetch, [Zod](https://zod.dev) validation, [cheerio](https://cheerio.js.org) HTML parsing, [Vercel Speed Insights](https://vercel.com/speed-insights)          |


**Tooling:** TypeScript, ESLint, Vitest, Prisma Migrate. The dev server is typically run on **port 3001** (`next dev -p 3001`).

---

## Core features

### Applications & pipeline

- **Jobs list** with columns (role, company, source, location, status, notes, actions), filters, and mobile card view.
- **Job detail** pages: notes, status, tags, AI-generated cover letter context, activity, and links to related tools.
- **Kanban-style board** and **“Today”** / **Dashboard** views for what to do next and recent activity.
- **Calendar** style views for interview dates where used.
- **Status workflow:** saved → applied → interview → offer / rejected / archived, with activity logging.

### Job search bot

- **Configurable search** (keywords, locations, excludes, experience, languages, minimum AI score, schedules).
- Pulls listings from external **job APIs** (RapidAPI Jobs Search API) per environment keys.
- **Deduplication** by URL and company + title; respects **dismissed** imports when a user deletes a job.
- **AI evaluation** (OpenAI) scores fit vs. your profile and preferences; jobs at or above your threshold are saved.
- **Bot runs** with logging/audit rows, optional **Telegram** summaries, and a **queue UI** for reviewed items.

### Email

- **IMAP (and OAuth-ready) integration**: connect an inbox, sync on a schedule or manually.
- **Classification and matching** of application-related mail to existing jobs; updates status and creates **notifications** when appropriate.
- **Sync history** and logs for debugging and transparency.

### Resume & interviews

- **Resume advisor** chat sessions against your materials.
- **Interview prep** sessions with AI-driven Q&A and session history.

### Browser extension

- **Extension key** per user to save jobs from the browser into Trackd (see `browser-extension/README.md`).

### Account & settings

- **Profile**, **integrations** (email, extension), **bot** settings, **onboarding** for new users.
- **Notifications** center and special flows for ambiguous or no-match cases.
- **Feedback** collection (including admin-side feedback review where enabled).

### Admin / operations

- **Cron-style API routes** (e.g. scheduled email sync, bot search) secured for deployment environments.
- **Feedback** and internal scripts for testing sync, bot search, and related flows (`package.json` scripts).

---

## Data model (high level)

Prisma models include among others:

- **Profile** — user display data (keyed like Supabase user id).
- **Job** — application record (source, URL, status, tags, notes, bot score/reasoning, import metadata).
- **Activity** — timeline of notes and status changes.
- **EmailIntegration**, **EmailSyncLog** — connection and sync diagnostics.
- **Notification** — in-app alerts.
- **ExtensionKey** — hashed API keys for the browser extension.
- **InterviewSession** / **InterviewMessage**, **ResumeSession** / **ResumeMessage** — AI conversation state.
- **BotConfig**, **BotResume**, **BotRun**, **BotRunLog**, **BotRunListing** — search configuration and run audit trail.
- **DismissedJobImport** — fingerprints so the bot does not re-import removed listings.
- **ApplicationProfile** / **ApplicationAttempt** — auto-apply related data where used.
- **Feedback** — user feedback records.

See `prisma/schema.prisma` for the full schema, enums, and indexes.

---

## Repository layout (rough)


| Path                 | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `src/app/`           | App Router: pages, layouts, API routes, server actions            |
| `src/components/`    | React components (layout, jobs, bot, email, UI primitives)        |
| `src/lib/`           | Auth, Prisma, AI client, bot orchestration, caching helpers, etc. |
| `prisma/`            | Schema and migrations                                             |
| `browser-extension/` | Extension package and docs                                        |
| `docs/`              | Additional documentation (this file, design notes, etc.)          |
| `scripts/`           | CLI tests and maintenance scripts                                 |


---

## Local development

1. Install dependencies (`npm`, `pnpm`, `bun`, etc.).
2. Configure environment variables (database URL, Supabase keys, OpenAI, optional RapidAPI keys for the bot, etc.) — use `.env.local` as appropriate.
3. Run `npx prisma migrate deploy` (or `prisma migrate dev`) and `npx prisma generate` as needed.
4. Start the app: `npm run dev` (serves on port **3001** in this repo’s default script).

For extension-specific setup, see `**browser-extension/README.md`**.

---

## Deployment notes

- Built for **Vercel** (or any Node host) with PostgreSQL reachable from the server.
- **Prisma** migrations should be applied in each environment.
- **Secrets** (OpenAI, IMAP, RapidAPI, cron auth) must be set in the host’s environment.

---

## Related docs

- `browser-extension/README.md` — Chrome extension and API key usage
- `docs/recruiter-interview-prep/README.md` — recruiter / interview prep notes (if present)
- `docs/BOT_RUN_AUDIT.md` — bot run audit trail (if present)
- `docs/PERF_BACKGROUND_JOBS.md` — performance / background job notes (if present)

This document is a high-level map; behavior details live in code and focused docs under `docs/`.
