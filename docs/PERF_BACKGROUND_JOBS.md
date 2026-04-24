# Background jobs (long-running work)

## Decision: **Vercel Workflow (WDK)** for durable fan-out (recommended when you outgrow `after()`)

| Option | When to use |
|--------|-------------|
| **`after()` (Next.js 16)** | Fire-and-forget after response; no durability across crashes. Used today for `triggerBotSearch` and `/api/cron/bot-search`. |
| **Vercel Workflow DevKit (WDK)** | Retries, step isolation, long-running with checkpoints; best fit for email sync + bot runs at scale. |
| **QStash / SQS** | If you already use Upstash or AWS; more moving parts. |

## Current implementation (this repo)

- **Manual “Run now”** — `settings/bot-actions.ts` `triggerBotSearch` schedules `executeBotRunForConfig` with `after()`; returns `{ success, queued: true }` immediately.
- **Cron bot search** — `api/cron/bot-search` enqueues one `after()` per active `BotConfig` and returns `{ queued: true }` without waiting.
- **URL scrape** — `POST /api/jobs/scrape-url` (120s `maxDuration`); clients use `scrapeJobUrlClient()` instead of a server action.

## Optional next step

- Move `syncEmails` to a WDK workflow with progress in DB + polling/SSE, so the integrations UI is not blocked on IMAP+AI (large behavior change; UI toast depends on full stats today).
