# E2E tests

Playwright smoke tests for beta readiness. Most smoke specs use the HTTP `request` fixture (no browser UI required).

## Commands

```bash
# Smoke only (starts dev server on :3001 unless PLAYWRIGHT_SKIP_SERVER=1)
npm run test:e2e:smoke

# Full E2E suite
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui
```

## Environment

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | Target URL (default `http://127.0.0.1:3001`) |
| `PLAYWRIGHT_PORT` | Port for CI `next start` (default `3001`) |
| `PLAYWRIGHT_SKIP_SERVER` | Set to `1` if the app is already running |
| `NEXT_PUBLIC_SUPABASE_URL` | Enables auth redirect smoke tests |

Auth redirect tests are **skipped** when Supabase env vars are absent (local smoke without `.env`).

## CI

`.github/workflows/ci.yml` runs `npm run test` then `npm run test:e2e:smoke` after `npm run build`.

For browser-based specs later, install Chromium in CI with:

```bash
npx playwright install chromium --with-deps
```
