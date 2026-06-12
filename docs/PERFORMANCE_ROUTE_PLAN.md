# Trackd Route Performance Plan

Date: 2026-06-12

## Issue being solved

Vercel Speed Insights still reports weak real-user performance after the first
jobs-list optimization pass:

- Desktop Real Experience Score: 65
- `/jobs`: 60
- `/bot`: 66
- `/bot/runs`: 80
- TTFB: 0.31s
- FCP: 4.34s
- LCP: 4.83s

The current goal is to improve route paint time, starting with `/jobs`.

## Root cause from inspection

The database/server portion is no longer the primary bottleneck. `/jobs` already
uses cached, paged server queries and the observed TTFB is healthy. The remaining
cost is likely browser paint and hydration:

- `/jobs` hydrates one large client component that includes table controls,
  mobile cards, status menus, tooltips, add-job modals, extension prompt, bulk
  actions, and column settings.
- The authenticated app shell mounts global bot progress, email sync progress,
  feedback, notifications, topbar, and sidebar for every route.
- Add-job modals and extension prompt were loaded even when closed or not needed.
- Initial `/jobs` payload still contained 50 jobs.

## Intended behavior

- `/jobs` should paint useful content quickly.
- Initial route load should hydrate only controls needed above the fold.
- Secondary controls should load after first paint or on direct interaction.
- Job status changes, load more, notifications, and global run/sync progress must
  keep working.

## Files added/edited with reasons

- `src/app/(authenticated)/jobs/page.tsx`
  - Reduce initial jobs from 50 to 25.
- `src/components/jobs/jobs-page-content.tsx`
  - Match client pagination to 25.
  - Render add-job modals only when opened.
  - Lazy-load and idle-defer the extension prompt.
- `src/components/layout/app-shell-client.tsx`
  - Lazy-load and idle-defer global bot/email progress and feedback widgets.
- `src/components/feedback/floating-feedback-button.tsx`
  - Lazy-load the feedback modal only when the feedback button is opened.
- `docs/PERFORMANCE_ROUTE_PLAN.md`
  - Record inspection, pre-mortem, implementation, and verification.

## Step-by-step implementation

1. Reduced `/jobs` initial server query size from 50 to 25 rows.
2. Reduced client "load more" page size to 25 rows.
3. Deferred the extension prompt until idle so it does not compete with first
   paint.
4. Stopped rendering add-job modals while closed so their chunks are not loaded
   on initial route open.
5. Deferred global progress/feedback widgets until idle so each authenticated
   page has a smaller first render.
6. Lazy-loaded the feedback modal only when the feedback button is used.

## Risks / pre-mortem

- Risk: Active bot/email progress may appear up to ~0.9-1.5s later.
  - Mitigation: Widgets still mount after idle or timeout and then use existing
    active-run polling.
- Risk: First-time extension prompt appears later.
  - Mitigation: It is non-critical to first paint and remains available after
    idle.
- Risk: Smaller initial jobs page feels like missing data.
  - Mitigation: Existing total counts and "Load more" affordance remain.
- Risk: Dynamic modal imports break open/close behavior.
  - Mitigation: The same modal components are used; they are only mounted when
    the corresponding open state is true.

## Tests to run

- `npx tsc --noEmit --pretty false`
- `npx eslint src/components/layout/app-shell-client.tsx src/components/jobs/jobs-page-content.tsx src/components/feedback/floating-feedback-button.tsx 'src/app/(authenticated)/jobs/page.tsx'`
- `npm test -- src/lib/cached-queries.test.ts src/app/api/bot/queue/count/route.test.ts`
- Browser verification for authenticated `/jobs`:
  - Initial list renders.
  - Load more works.
  - Add job modal still opens.
  - Extension prompt still appears after idle for eligible users.
  - Global bot/email progress appears when an active run/sync exists.

## Dogfood / JSONL verification plan

Use production Vercel Speed Insights after deploy as the real-user signal:

1. Deploy the slice.
2. Exercise `/jobs` desktop and mobile several times while authenticated.
3. Exercise `/bot` and `/bot/runs` once to ensure deferred global widgets do not
   regress those pages.
4. Re-check Vercel Speed Insights after enough visits land.
5. Compare `/jobs` RES, FCP, LCP, and route sample count against this baseline.

Local browser caveat: a new local in-app browser tab redirects to login without
the user's localhost auth session, so authenticated `/jobs` visual verification
needs to be done in the already-authenticated browser session or against
production after deployment.

## Rollback or follow-up decision point

Rollback this slice if:

- Add-job modal or status update interaction breaks.
- Global bot/email progress no longer appears during active runs.
- `/jobs` route score does not improve after enough production samples.

If this slice is stable but still insufficient, next follow-up is to split
`JobsPageContent` into a lighter first-paint list shell and lazy row controls.
