# Background jobs (long-running work)

## Decision: **Vercel Queues** for manual Job Search runs

| Option | When to use |
|--------|-------------|
| **`after()` (Next.js 16)** | Short fire-and-forget work after response; no durable delivery guarantee for long AI/provider jobs. |
| **Vercel Queues** | Durable delivery, retries, and a fast user response. Used for manual Job Search runs. |
| **Vercel Workflow DevKit (WDK)** | Step isolation and checkpoints; best fit if bot runs become multi-step workflows with pause/resume. |
| **QStash / SQS** | If you already use Upstash or AWS; more moving parts. |

## Current implementation (this repo)

- **Manual “Run now”** — `POST /api/bot/run` reserves a `BotRun`, publishes `trackd-bot-manual-runs` to Vercel Queues, and returns `202` immediately. The client polls `GET /api/bot/run/[runId]`.
- **Manual queue consumer** — `api/queues/bot-manual-run` receives the queue message and calls `executeStartedBotRunForConfig`, preserving the existing scoring, saving, audit, notification, and Telegram behavior.
- **Cron bot search** — `api/cron/bot-search` still awaits `executeBotRunForConfig` synchronously because it already runs outside a browser request.
- **URL scrape** — `POST /api/jobs/scrape-url` (120s `maxDuration`); clients use `scrapeJobUrlClient()` instead of a server action.

## Optional next step

- Move `syncEmails` to a queue or WDK workflow with progress in DB + polling/SSE, so the integrations UI is not blocked on IMAP+AI (large behavior change; UI toast depends on full stats today).
