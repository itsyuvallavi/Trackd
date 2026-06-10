# Trackd E2E Plan — Beta Readiness

End-to-end plan for validating Trackd before inviting a small tester group. Covers infrastructure, manual QA, automated tests, extension flows, and beta rollout.

**Current state (baseline):**
- 305 Vitest unit/integration tests passing (`npm run test`)
- No web E2E suite (Playwright/Cypress)
- Manual checklists exist but are unchecked (`docs/TESTING_CHECKLIST.md`)
- Route smoke script exists (`npm run test:routes`)
- Bot dogfood script is internal-only (`npm run test:bot:e2e`)

**Target:** Green manual QA on P0 journeys + minimal Playwright smoke in CI before first external invite.

### Implementation status (`chore/e2e-beta-readiness`)

| Item | Status |
|------|--------|
| Playwright scaffold + smoke specs | Done — `e2e/smoke/`, `playwright.config.ts` |
| Extension API journey spec | Done — `e2e/journeys/extension-api.spec.ts` |
| CI workflow (unit + E2E smoke) | Done — `.github/workflows/ci.yml` |
| Beta tester guide | Done — `docs/BETA_TESTER_GUIDE.md` |
| Beta env checker | Done — `npm run check:beta-env` |
| Extension doc port fix (3001) | Done — `browser-extension/TESTING.md` |
| Cron auth documentation | Done — comment in `src/lib/cron-auth.ts` |
| Security migration commit | Pending deploy — file exists, apply on staging/prod |
| Manual Phase 1 QA | Pending — human + real OAuth/mail |
| Playwright authenticated journeys | Pending — needs E2E test user + Supabase |

---

## Phase 0 — Infrastructure & deploy gates

Complete these before any E2E work against production/staging.

### Step 0.1 — Choose environment

| Environment | Use for |
|-------------|---------|
| **Local** (`localhost:3001`) | Dev, Playwright authoring, extension sideload |
| **Staging** (recommended) | Full manual QA + first 1–2 internal dogfooders |
| **Production** | Beta testers after staging is green |

Record the canonical URL: `_________________________`

### Step 0.2 — Deploy security hardening

- [ ] Commit and deploy `prisma/migrations/20260609193000_security_hardening`
- [ ] Run `prisma migrate deploy` on target DB
- [ ] Verify resume bucket is private and signed-URL routes work:
  - Upload a resume in `/bot/resumes` or resume advisor
  - Confirm file loads via app (not public Supabase URL)

### Step 0.3 — Production env checklist

Set every variable from `.env.example` on Vercel (or staging). Minimum for beta:

| Variable | Required for |
|----------|--------------|
| `DATABASE_URL` | All features |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage, admin ops |
| `NEXT_PUBLIC_APP_URL` | OAuth redirects, extension |
| `OPENAI_API_KEY` | Email classification, bot, resume |
| `EMAIL_OAUTH_STATE_SECRET` | Gmail/Outlook OAuth |
| `EMAIL_CREDENTIAL_ENCRYPTION_KEY` | Stored email tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google login + Gmail sync |
| `CRON_SECRET` | Background email sync |
| `ADMIN_EMAIL` | Feedback admin inbox |
| `RESEND_API_KEY` | Feedback emails (optional) |
| `JOBS_SEARCH_API_KEY` | Bot search only (opt-in testers) |

### Step 0.4 — Supabase & OAuth configuration

- [ ] Supabase **Site URL** = `NEXT_PUBLIC_APP_URL`
- [ ] Redirect URLs include `{APP_URL}/auth/callback`
- [ ] Google Cloud: redirect `{APP_URL}/api/auth/email/oauth/callback`
- [ ] Azure (Outlook): same callback URL
- [ ] Add beta tester emails as **Google OAuth test users** (until app is published)

### Step 0.5 — Cron strategy (pick one, document it)

**Option A (current working path):** GitHub Actions hourly sync  
- [ ] Confirm `.github/workflows/sync-emails.yml` secrets: `APP_URL`, `CRON_SECRET`
- [ ] Manually trigger workflow → verify 200 from `/api/cron/sync-emails`

**Option B:** Fix Vercel crons  
- Vercel cron requests do not send `Authorization: Bearer CRON_SECRET` today (`src/lib/cron-auth.ts`)
- [ ] Either wrap cron routes to accept Vercel's signed cron header, or remove broken crons from `vercel.json`

### Step 0.6 — Smoke after deploy

```bash
SMOKE_BASE_URL=https://your-staging-url npm run test:routes
```

- [ ] All routes pass
- [ ] `npm run build` succeeds locally (already verified)

**Gate:** Do not proceed to Phase 1 until Steps 0.2–0.6 pass on staging.

---

## Phase 1 — Manual E2E (P0 journeys)

Walk these in order on **staging** with two separate test accounts (User A and User B). Check off in `docs/TESTING_CHECKLIST.md` as you go.

Estimated time: **4–6 hours** for one person.

### Journey 1 — Sign up & onboarding (30 min)

**Account:** User A (new email never used in Trackd)

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Visit `/signup`, create email/password account | Account created |
| 1.2 | Complete email confirmation if Supabase requires it | Can sign in |
| 1.3 | After first login | Redirect to `/onboarding` |
| 1.4 | Welcome step → "Get Started" | Email sync step |
| 1.5 | Click "Set up later" | Complete step |
| 1.6 | Complete step → continue | Redirect to `/jobs`, empty list |
| 1.7 | In DB or Supabase metadata | `onboarding_completed: true` |
| 1.8 | Log out, visit `/jobs` while logged out | Redirect to login |
| 1.9 | Repeat 1.1–1.6 with **Google Sign Up** (User A2 or separate) | Same onboarding path |

**Pass criteria:** Both auth methods land on onboarding once, then `/jobs`. Protected routes block unauthenticated access.

### Journey 2 — Jobs CRUD & isolation (45 min)

**Accounts:** User A (has jobs), User B (new)

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | User A: Add job via modal | Job in list |
| 2.2 | User A: Add job from URL (LinkedIn or Indeed URL) | Scrape preview → save |
| 2.3 | User A: Open job detail, edit status/notes | Persists on refresh |
| 2.4 | User A: Visit `/board` | Job appears in correct column |
| 2.5 | User A: Delete one job | Removed from list and board |
| 2.6 | User B: Sign up, add 1 job | Sees only their job |
| 2.7 | User B: Cannot see User A jobs (API or UI) | Data isolated |
| 2.8 | User A: Log back in | Still sees only User A jobs |

**Pass criteria:** No cross-user data leakage.

### Journey 3 — Profile & feedback (20 min)

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | `/profile` → update display name | Avatar initials update |
| 3.2 | Open feedback from user menu | Modal opens |
| 3.3 | Submit feedback with message | Success toast |
| 3.4 | As `ADMIN_EMAIL` user, visit `/admin/feedback` | Submission visible |

**Pass criteria:** Feedback round-trip works; non-admin cannot access `/admin/feedback`.

### Journey 4 — Email sync (60–90 min)

Requires a real Gmail or Outlook account with job-related emails (or seed test emails).

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | `/settings/integrations` → Connect Google | OAuth completes, connected status |
| 4.2 | Click "Sync Now" | Success stats (processed, matched, etc.) |
| 4.3 | Check notification bell | Sync summary or job updates |
| 4.4 | If ambiguous match exists | Resolution flow works (`/notifications/ambiguous`) |
| 4.5 | If new job detected | "Create Job" from notification works |
| 4.6 | Enable auto-sync in settings | `lastSyncedAt` updates on next cron run |
| 4.7 | Disconnect integration | Sync button disabled / reconnect prompt |

**Pass criteria:** OAuth callback, sync, and at least one notification type work. See `docs/TESTING_GUIDE.md` for edge cases.

### Journey 5 — Browser extension (45–60 min)

Use `browser-extension/TESTING.md`. App runs on **port 3001** locally.

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | `/settings/integrations` → Generate extension key | `tk_...` key shown |
| 5.2 | Load unpacked extension from `browser-extension/` | Extension icon visible |
| 5.3 | Point extension at staging: `chrome.storage.local.set({ trackdApiUrl: 'https://...' })` | API calls hit staging |
| 5.4 | Connect with key | "Connected as [email]" |
| 5.5 | LinkedIn job page → open popup → Save | Success + job in `/jobs` |
| 5.6 | Indeed job page → save | Source = Indeed |
| 5.7 | Invalid key → connect | Clear error message |
| 5.8 | Disconnect extension | Requires key again |

**Pass criteria:** LinkedIn + one other board save end-to-end. Extension works against staging URL.

### Journey 6 — Sign in & session (15 min)

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Google sign-in (returning user) | Lands on `/jobs` (skips onboarding) |
| 6.2 | Email/password sign-in | Same |
| 6.3 | Wrong password | Error shown, no redirect |
| 6.4 | Log out → visit `/login` while logged out | Login form works |

**Pass criteria:** Returning users skip onboarding; errors are user-visible.

---

## Phase 2 — Manual E2E (P1 — optional beta features)

Run only if those features are in beta scope.

### Journey 7 — Job Search bot (opt-in, 60 min)

**Requires:** `JOBS_SEARCH_API_KEY`, `OPENAI_API_KEY`, bot settings configured.

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | `/bot/settings` → configure search profile + resume | Settings save |
| 7.2 | `/bot` → start manual run | Run appears in progress strip |
| 7.3 | `/bot/queue` | Scored jobs appear |
| 7.4 | Add to applications from queue | Job in `/jobs` |
| 7.5 | `/bot/runs` | Audit trail for run |

**Out of scope for v1 beta:** Auto-apply (`AutoApplyDrawer` not wired to UI).

### Journey 8 — Resume Advisor (30 min)

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Upload PDF resume | Parse succeeds |
| 8.2 | Start chat session | AI responds |
| 8.3 | Download/export if available | File downloads |

### Journey 9 — Interview prep (30 min)

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | Start session from `/interview-prep` | Session created |
| 9.2 | Complete one question round | State persists |

---

## Phase 3 — Automated E2E (Playwright)

Introduce Playwright for regression protection. `playwright-core` is already a dependency; add `@playwright/test` as devDependency.

### Step 3.1 — Scaffold

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Suggested layout:

```
e2e/
  fixtures/
    auth.ts          # login helpers, test user seeding
  smoke/
    public-routes.spec.ts
    auth-redirects.spec.ts
  journeys/
    signup-onboarding.spec.ts
    jobs-crud.spec.ts
    extension-api.spec.ts   # API-level, not full extension UI
  playwright.config.ts
```

Add scripts to `package.json`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:smoke": "playwright test e2e/smoke"
```

### Step 3.2 — P0 automated specs (implement in order)

#### Spec 1: `public-routes.spec.ts` (smoke — ~1 hour)

| Test | Assert |
|------|--------|
| `GET /` | 200, login/signup visible |
| `GET /signup` | 200 |
| `GET /jobs` (no session) | Redirect to login with `next=/jobs` |
| `GET /api/bot/queue/count` (no auth) | 401 |

Replaces/extends `scripts/smoke-routes.ts` with browser-level checks.

#### Spec 2: `auth-redirects.spec.ts` (~2 hours)

| Test | Assert |
|------|--------|
| Logged-out → `/settings/integrations` | Redirect to login |
| Logged-in → `/login` | Redirect to `/jobs` |
| Logged-in → `/` | Redirect to `/jobs` |

Use Supabase service role or pre-seeded test user + storage state.

#### Spec 3: `signup-onboarding.spec.ts` (~4 hours)

| Test | Assert |
|------|--------|
| Email signup (test inbox or Supabase admin confirm) | Lands on `/onboarding` |
| Skip email setup | Reaches `/jobs` |
| Direct `/jobs` before onboarding complete | Redirect to `/onboarding` |

**Note:** Google OAuth is hard to automate — keep as manual-only unless using Supabase test helpers.

#### Spec 4: `jobs-crud.spec.ts` (~3 hours)

| Test | Assert |
|------|--------|
| Create job via UI | Appears in list |
| Open detail, change status | Persists after reload |
| Delete job | Gone from list |

Use authenticated `storageState` fixture.

#### Spec 5: `extension-api.spec.ts` (~2 hours)

API-level (no Chrome extension UI):

| Test | Assert |
|------|--------|
| `POST /api/extension/validate-key` with valid key | 200 |
| `POST /api/extension/save-job` with valid payload | Job created |
| Invalid key | 401 |

Validates extension contract without Playwright extension loading (defer full extension E2E to Phase 4).

### Step 3.3 — Test data strategy

| Approach | Use when |
|----------|----------|
| **Dedicated test users** | `e2e-user-a@test.trackd.app` seeded via Supabase Admin API |
| **Storage state** | `e2e/.auth/user.json` committed to CI secrets or generated per run |
| **DB cleanup** | `scripts/wipe-user-job-data.ts` or truncate jobs for test user after suite |
| **Mail** | Mailosaur/MailSlurp for email signup, or disable email confirm in Supabase for E2E project only |

### Step 3.4 — CI integration

Add `.github/workflows/e2e.yml`:

```yaml
name: E2E
on: [pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run test
  smoke:
    needs: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run build && npm run start &
      - run: npx wait-on http://127.0.0.1:3000 && npm run test:e2e:smoke
    env:
      # Minimal env for build — use GitHub secrets for real values
      DATABASE_URL: ${{ secrets.E2E_DATABASE_URL }}
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
      # ...
```

Start with **smoke only in CI**; full journeys run nightly or pre-release.

### Step 3.5 — Success criteria for automation

| Milestone | Specs green |
|-----------|-------------|
| **M1 — CI smoke** | Specs 1–2 |
| **M2 — Core regression** | Specs 1–4 |
| **M3 — Extension contract** | Specs 1–5 |

---

## Phase 4 — Extension full E2E (later)

Deferred until P0 web journeys are stable.

| Step | Description |
|------|-------------|
| 4.1 | Use Playwright `chromium.launchPersistentContext` with `--load-extension` |
| 4.2 | Automate popup connect + LinkedIn save (see `browser-extension/TESTING.md` §2.1) |
| 4.3 | Run against staging only (host permissions in manifest) |

Tracked as TODO in `browser-extension/TESTING.md`.

---

## Phase 5 — Beta rollout

### Step 5.1 — Define beta scope document (1 page for testers)

Include:
- App URL
- Supported browsers (Chrome for extension)
- Extension install: download zip from `/api/download-extension` or load unpacked
- **In scope:** jobs, board, email sync, extension, feedback
- **Optional:** bot search (by invitation)
- **Not available:** auto-apply, password reset
- How to report bugs (feedback modal + email)
- Data notice: resumes and email processed by OpenAI

### Step 5.2 — Internal dogfood (2–3 people, 3 days)

- [ ] Phase 1 P0 journeys green on staging
- [ ] Collect bugs in `/admin/feedback`
- [ ] Fix P0 bugs before external invite

### Step 5.3 — Closed beta cohort 1 (5–10 testers, 1 week)

| Day | Action |
|-----|--------|
| D0 | Send invite + install guide; add emails to Google OAuth test users |
| D1 | Monitor feedback admin + server logs |
| D3 | Mid-week check-in (what's broken, what's unused) |
| D7 | Retrospective: go/no-go for cohort 2 |

### Step 5.4 — Go/no-go criteria

**Invite cohort 1 when ALL true:**

- [ ] Phase 0 complete on production (or dedicated beta URL)
- [ ] Phase 1 Journeys 1–6 passed on staging
- [ ] No open P0 bugs (auth, data leak, email sync crash, extension save failure)
- [ ] Beta scope doc sent to testers
- [ ] At least M1 Playwright smoke in CI (recommended)

**Do not invite when:**

- Security migration not deployed
- Cron/email sync untested in target environment
- Known cross-user data exposure

---

## Priority matrix

| ID | Journey / work | Priority | Automate? | Beta scope |
|----|----------------|----------|-----------|------------|
| J1 | Sign up & onboarding | P0 | Partial | Yes |
| J2 | Jobs CRUD & isolation | P0 | Yes | Yes |
| J3 | Profile & feedback | P0 | Yes | Yes |
| J4 | Email sync | P0 | No (OAuth) | Yes |
| J5 | Browser extension | P0 | API only → full later | Yes |
| J6 | Sign in & session | P0 | Yes | Yes |
| J7 | Job Search bot | P1 | Partial (`test:bot:e2e`) | Opt-in |
| J8 | Resume Advisor | P1 | Later | Optional |
| J9 | Interview prep | P1 | Later | Optional |
| — | Auto-apply | — | — | **Excluded** |
| P0 | Infrastructure gates | P0 | `test:routes` | Pre-req |
| P3 | Playwright smoke | P0 | Yes | Pre-req (recommended) |

---

## Execution timeline (suggested)

| Week | Focus |
|------|-------|
| **Week 1** | Phase 0 (deploy + env + cron) + Phase 1 Journeys 1–3 |
| **Week 2** | Phase 1 Journeys 4–6 + Phase 3 Specs 1–2 + CI smoke |
| **Week 3** | Phase 3 Specs 3–5 + Phase 5.1 beta doc + internal dogfood |
| **Week 4** | Cohort 1 invite + monitor |

Adjust based on team size. Minimum viable path to beta: **Phase 0 + Phase 1 (J1–J6) + beta doc** — automation can follow in parallel.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| `docs/TESTING_CHECKLIST.md` | Detailed manual checkboxes (use during Phase 1) |
| `docs/TESTING_GUIDE.md` | Email sync edge cases |
| `browser-extension/TESTING.md` | Extension manual suite |
| `.env.example` | Required environment variables |
| `docs/OAUTH_PRODUCTION_SETUP.md` | OAuth provider setup |

---

## Quick command reference

```bash
# Unit/integration
npm run test

# Route smoke (server must be running)
npm run test:routes
SMOKE_BASE_URL=https://staging.example.com npm run test:routes

# Bot internal dogfood (not for CI)
RUN_BOT_E2E_DOGFOOD=1 npm run test:bot:e2e

# Future Playwright
npm run test:e2e
npm run test:e2e:smoke
```
