#!/usr/bin/env tsx
/**
 * Export Playwright storageState from your real Chrome session (Indeed login).
 *
 * Why CDP: Playwright cannot read Chrome’s encrypted default cookie DB; we attach to a live Chrome
 * and call storageState(). Chrome requires --user-data-dir (separate profile) + --remote-debugging-port.
 *
 * Run: `bun run export:apply-storage` (uses Node + tsx — Bun alone often hangs on Chrome’s CDP WebSocket).
 * With Chrome off, the error text prints the exact Chrome command (storage/chrome-cdp-profile).
 *
 * Output: storage/apply-state.json (gitignored). Point BROWSER_APPLY_STORAGE_STATE at it (already in .env).
 *
 * Default exports Indeed-related cookies/origins only (LinkedIn and other sites excluded).
 * Full profile export (not recommended):
 *      bun run export:apply-storage -- --all-sites
 *
 * Optional: CHROME_CDP_URL=http://127.0.0.1:9223 bun run export:apply-storage
 * Or: bun run export:apply-storage -- --port 9223
 */

import fs from 'fs'
import path from 'path'
import { filterIndeedStorageState } from '../src/lib/bot/apply/indeed-storage-state'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require('playwright-core') as typeof import('playwright-core')

const OUT = path.join(process.cwd(), 'storage', 'apply-state.json')
/** Separate profile so Chrome allows --remote-debugging-port (not your daily Default profile). */
const CHROME_DEBUG_USER_DATA_DIR = path.join(process.cwd(), 'storage', 'chrome-cdp-profile')
const indeedOnly = !process.argv.includes('--all-sites')

/** Chrome CDP WebSocket handshake can stall under Bun; tsx/Node is the default runner. */
const CDP_CONNECT_TIMEOUT_MS = 180_000

async function fetchWebSocketDebuggerUrl(cdpHttpBase: string): Promise<string> {
  const base = cdpHttpBase.replace(/\/$/, '')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch(`${base}/json/version`, { signal: ctrl.signal })
    if (!res.ok) {
      throw new Error(`GET ${base}/json/version → HTTP ${res.status}`)
    }
    const data = (await res.json()) as { webSocketDebuggerUrl?: string }
    if (!data.webSocketDebuggerUrl) {
      throw new Error('Response missing webSocketDebuggerUrl')
    }
    return data.webSocketDebuggerUrl
  } finally {
    clearTimeout(timer)
  }
}

function printTimeoutHelp(cdpUrl: string, wsUrl: string | null) {
  const profile = CHROME_DEBUG_USER_DATA_DIR
  const port = cdpPortForHelp(cdpUrl)
  console.error(`
Timed out connecting Playwright to Chrome CDP (HTTP works but WebSocket handshake hung).

Common causes: VPN / Little Snitch / corporate firewall blocking local WebSocket, or running the
export script with Bun (use the default \`bun run export:apply-storage\`, which runs tsx + Node).

Try:

  1) Same Chrome command, add an explicit bind (then restart Chrome):

     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
       --user-data-dir="${profile}" \\
       --remote-debugging-port=${port} \\
       --remote-debugging-address=127.0.0.1

  2) Run export again:  bun run export:apply-storage

  3) If it still hangs, skip CDP and save storage from Playwright’s own browser (Indeed login once):

     cd ${process.cwd()}
     npx -y playwright@1.58.2 install chromium
     npx -y playwright@1.58.2 open https://www.indeed.com --save-storage=storage/apply-state.json

     Close the browser when done; then re-run Indeed-only filter if you need only Indeed cookies
     (the file may include other sites — you can re-run this CDP script after trimming, or edit JSON).

${wsUrl ? `WebSocket was: ${wsUrl.slice(0, 80)}…` : ''}
`.trim())
}

function resolveCdpUrl(): string {
  const fromEnv = process.env.CHROME_CDP_URL?.trim()
  if (fromEnv) return fromEnv

  const portEq = process.argv.find((a) => a.startsWith('--port='))
  if (portEq) {
    const p = portEq.slice('--port='.length).trim()
    if (/^\d+$/.test(p)) return `http://127.0.0.1:${p}`
  }
  const portIdx = process.argv.indexOf('--port')
  if (portIdx >= 0) {
    const p = process.argv[portIdx + 1]?.trim()
    if (p && /^\d+$/.test(p)) return `http://127.0.0.1:${p}`
  }
  return 'http://127.0.0.1:9222'
}

function cdpPortForHelp(cdpUrl: string): string {
  try {
    const u = new URL(cdpUrl)
    return u.port || '9222'
  } catch {
    return '9222'
  }
}

function printConnectionHelp(cdpUrl: string) {
  const port = cdpPortForHelp(cdpUrl)
  const profile = CHROME_DEBUG_USER_DATA_DIR
  console.error(`
ECONNREFUSED — nothing is accepting DevTools on ${cdpUrl}

Chrome requires a non-default --user-data-dir when using --remote-debugging-port (your error:
"DevTools remote debugging requires a non-default data directory").

Do this in order:

  1) Quit Chrome fully: Cmd+Q. Activity Monitor → "Google Chrome" → Force Quit if needed.

  2) From your project root, start Chrome with a dedicated profile folder (copy both lines as one command):

     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
       --user-data-dir="${profile}" \\
       --remote-debugging-port=${port} \\
       --remote-debugging-address=127.0.0.1

     First run: log into Indeed in this window. That login is stored only under storage/chrome-cdp-profile/
     (not your normal Chrome profile). Reuse the same command later to keep the session.

  3) Confirm the debug port (should print JSON):

     curl -s "http://127.0.0.1:${port}/json/version"

  4) Then:

     bun run export:apply-storage${port === '9222' ? '' : ` -- --port ${port}`}

Other ports: use 9223 in both the Chrome flag and:
     bun run export:apply-storage -- --port 9223
`.trim())
}

async function main() {
  const cdpUrl = resolveCdpUrl()
  let browser: import('playwright-core').Browser | null = null
  let wsUrlForHelp: string | null = null
  try {
    wsUrlForHelp = await fetchWebSocketDebuggerUrl(cdpUrl)
    browser = await chromium.connectOverCDP(wsUrlForHelp, {
      timeout: CDP_CONNECT_TIMEOUT_MS,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const refused = /ECONNREFUSED|connect.*refused/i.test(msg)
    const timedOut = /timeout|timed out|abort/i.test(msg)
    if (refused) {
      printConnectionHelp(cdpUrl)
    } else if (timedOut) {
      printTimeoutHelp(cdpUrl, wsUrlForHelp)
    } else {
      console.error(`Could not attach to Chrome at ${cdpUrl}\n${msg}`)
    }
    process.exit(1)
  }

  try {
    const contexts = browser.contexts()
    if (!contexts.length) {
      console.error('No browser contexts found.')
      process.exit(1)
    }

    const ctx = contexts[0]
    const state = await ctx.storageState()

    const out = indeedOnly ? filterIndeedStorageState(state) : state

    if (indeedOnly && out.cookies.length === 0) {
      console.warn(
        'No Indeed cookies found in this Chrome profile. Open Indeed in this Chrome window, reload, then run again.\n' +
          'If you use a separate Chrome profile, start Chrome with that profile + remote-debugging-port.'
      )
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')

    console.log(
      `Wrote ${OUT}\n` +
        `  cookies: ${out.cookies.length}\n` +
        `  origins: ${out.origins.length}\n` +
        (indeedOnly ? '  filter: Indeed-only (use --all-sites to include every site — not recommended)\n' : '')
    )
  } finally {
    await browser.close().catch(() => {})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
