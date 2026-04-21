/**
 * Browserless.io connection manager.
 * Playwright is required only inside withBrowser() so this module is safe to
 * import from the graph without executing native code at load time.
 *
 * Uses Playwright's native WebSocket transport (/chromium/playwright), not
 * connectOverCDP. CDP mode on Browserless often yielded ~800px-wide fullPage
 * screenshots regardless of viewport.
 *
 * Keep playwright-core on the same minor as Browserless (see package.json);
 * mismatches return HTTP 428 from the service.
 *
 * **Warm sessions:** set `BROWSER_APPLY_STORAGE_STATE` to a JSON file produced by
 * Playwright (`await context.storageState({ path: 'apply-state.json' })`) after you
 * sign in / pass checks in a real browser session. That file is cookies + origin
 * storage — not full Chromium cache/history, but enough for many logged-in flows.
 * Do not commit that file; on Vercel use a secret file or future DB-backed state.
 * Generate Indeed-only state from your real Chrome: `bun run export:apply-storage` (see scripts/export-indeed-storage-state.ts).
 *
 * After each apply, the Browserless/local context’s **full** storage state is written back to the same JSON
 * path unless `BROWSER_APPLY_STORAGE_STATE_SAVE=0`. On Vercel the filesystem is ephemeral.
 *
 * **Watch the bot live:**
 * - `BROWSER_APPLY_CHROME_ATTACH=1` — Playwright **attaches** to Chrome you started with `--remote-debugging-port`
 *   (see export script help). Opens a **new tab** in that same browser; you watch on your desktop (not embedded in localhost).
 * - Or `BROWSER_APPLY_CHROME_LOCAL=1` + `BROWSER_APPLY_CHROME_HEADED=1` — Playwright launches a **separate** Chrome window.
 * Optional `BROWSER_APPLY_SLOW_MO_MS=250` slows Playwright ops (local launch only; headed defaults to 150ms if unset).
 * `BROWSER_APPLY_ACTION_DELAY_MS=400` pauses between each planned form step so you can follow typing/clicks.
 * `BROWSER_APPLY_PAUSE_MS_BEFORE_CLOSE` (default 30s when watching headed/attach) keeps the window open after the run; set to `0` to close immediately.
 * **Browserless** = screenshots in the app only — no live video in localhost.
 *
 * **Personal / local session:** Remote IPs (Browserless) often break site logins; local Chrome matches your Mac.
 * `TRACKD_PROJECT_ROOT` or an absolute `BROWSER_APPLY_STORAGE_STATE` helps find `storage/apply-state.json`
 * if `process.cwd()` is not the repo root.
 */

import path from 'path'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import { logApply, truncate } from '@/lib/bot/apply/apply-log'
import {
  findApplyStorageStateFilePath,
  getApplyStorageStateWritePath,
  persistIndeedStorageStateAfterApply,
} from '@/lib/bot/apply/indeed-storage-state'

/** Must match chromium.connect — see Browserless connection URL patterns. */
const BROWSERLESS_WS = 'wss://production-sfo.browserless.io/chromium/playwright'

/**
 * Reads Browserless credentials from the server environment.
 * Trims whitespace (common when pasting into Vercel). Accepts BROWSERLESS_TOKEN
 * as an alias because Browserless often labels the value "token" in the UI.
 */
export function getBrowserlessApiKey(): string | undefined {
  const raw =
    process.env.BROWSERLESS_API_KEY?.trim() ||
    process.env.BROWSERLESS_TOKEN?.trim()
  return raw || undefined
}

export function isBrowserlessConfigured(): boolean {
  return Boolean(getBrowserlessApiKey())
}

/** Use installed Google Chrome on this machine (good for cookie sessions; same rough network as you). */
export function useLocalChromeForApply(): boolean {
  return process.env.BROWSER_APPLY_CHROME_LOCAL?.trim() === '1'
}

/**
 * Attach to Chrome you already started with `--remote-debugging-port` (same window/profile you see).
 * Set CHROME_CDP_URL (default http://127.0.0.1:9222). Implies live viewing in **that** Chrome, not inside Next.js.
 */
export function useChromeAttachForApply(): boolean {
  return process.env.BROWSER_APPLY_CHROME_ATTACH?.trim() === '1'
}

/** Auto-apply: Browserless, or local launched Chrome, or attach to your running Chrome. */
export function isApplyBrowserConfigured(): boolean {
  return isBrowserlessConfigured() || useLocalChromeForApply() || useChromeAttachForApply()
}

const CDP_ATTACH_TIMEOUT_MS = 120_000

async function fetchChromeWebSocketDebuggerUrl(cdpHttpBase: string): Promise<string> {
  const base = cdpHttpBase.replace(/\/$/, '')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch(`${base}/json/version`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`GET ${base}/json/version → ${res.status}`)
    const data = (await res.json()) as { webSocketDebuggerUrl?: string }
    if (!data.webSocketDebuggerUrl) throw new Error('missing webSocketDebuggerUrl')
    return data.webSocketDebuggerUrl
  } finally {
    clearTimeout(timer)
  }
}

function parseLocalChromeSlowMoMs(): number | undefined {
  const raw = process.env.BROWSER_APPLY_SLOW_MO_MS?.trim() || process.env.BROWSER_APPLY_SLOWMO_MS?.trim()
  if (!raw) return undefined
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) return undefined
  return Math.min(n, 2000)
}

/** When watching local/attached Chrome, keep the window open this long before disconnect (0 = skip). */
function pauseMsBeforeClose(visualWatch: boolean): number {
  if (!visualWatch) return 0
  const off = process.env.BROWSER_APPLY_PAUSE_MS_BEFORE_CLOSE?.trim() === '0'
  if (off) return 0
  const raw = process.env.BROWSER_APPLY_PAUSE_MS_BEFORE_CLOSE?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n)) return Math.max(0, Math.min(n, 600_000))
  }
  return 30_000
}

export function getBrowserlessUrl(): string {
  const key = getBrowserlessApiKey()
  if (!key) throw new Error('BROWSERLESS_API_KEY is not set')
  const { width, height } = getApplyBrowserViewport()
  // Still pass --window-size so the remote Chrome window matches our viewport (helps headful/layout).
  const launch = JSON.stringify({
    args: [`--window-size=${width},${height}`, '--lang=en-US'],
  })
  return `${BROWSERLESS_WS}?token=${encodeURIComponent(key)}&launch=${encodeURIComponent(launch)}`
}

/** Desktop viewport for apply screenshots — narrow viewports make responsive sites collapse and PNGs look “cropped”. */
export function getApplyBrowserViewport(): { width: number; height: number } {
  const width = Math.min(
    3840,
    Math.max(1280, parseInt(process.env.BROWSER_APPLY_VIEWPORT_WIDTH || '1920', 10) || 1920)
  )
  const height = Math.min(
    2160,
    Math.max(720, parseInt(process.env.BROWSER_APPLY_VIEWPORT_HEIGHT || '1080', 10) || 1080)
  )
  return { width, height }
}

/**
 * Optional path to Playwright `storageState` JSON (cookies + origins).
 * Returns `undefined` if unset, missing, or invalid (see findApplyStorageStateFilePath).
 */
export function resolveApplyStorageStatePath(): string | undefined {
  const found = findApplyStorageStateFilePath()
  if (!found) {
    if (process.env.BROWSER_APPLY_STORAGE_STATE?.trim()) {
      logApply('browser_storage_state', { applied: false, reason: 'file_missing_or_invalid' })
    }
    return undefined
  }
  return found
}

export async function withBrowser<T>(
  fn: (page: Page) => Promise<T>,
  options: { timeout?: number } = {}
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('playwright-core') as typeof import('playwright-core')

  const useAttach = useChromeAttachForApply()
  const useLocalChrome = useLocalChromeForApply()
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let attachedToExistingChrome = false
  let headedLocalChrome = false

  try {
    if (useAttach) {
      const cdpBase = process.env.CHROME_CDP_URL?.trim() || 'http://127.0.0.1:9222'
      const wsUrl = await fetchChromeWebSocketDebuggerUrl(cdpBase)
      browser = await chromium.connectOverCDP(wsUrl, { timeout: CDP_ATTACH_TIMEOUT_MS })
      const contexts = browser.contexts()
      if (!contexts.length) {
        throw new Error(
          'Chrome has no browser contexts. Start Chrome with --remote-debugging-port and --user-data-dir (see scripts/export-indeed-storage-state.ts help).'
        )
      }
      context = contexts[0]
      attachedToExistingChrome = true
      logApply('browser_transport', {
        transport: 'chrome_attach',
        cdp: truncate(cdpBase, 64),
      })
      if (findApplyStorageStateFilePath()) {
        logApply('browser_storage_state', {
          attachMode: true,
          note: 'BROWSER_APPLY_STORAGE_STATE ignored — using your live Chrome cookies/profile',
        })
      }
    } else if (useLocalChrome) {
      const headed = process.env.BROWSER_APPLY_CHROME_HEADED?.trim() === '1'
      headedLocalChrome = headed
      let slowMo = parseLocalChromeSlowMoMs()
      if (slowMo === undefined && headed) {
        slowMo = 150
      }
      browser = await chromium.launch({
        channel: 'chrome',
        headless: !headed,
        ...(slowMo != null ? { slowMo } : {}),
      })
      logApply('browser_transport', {
        transport: 'local_chrome',
        headed,
        slowMoMs: slowMo ?? null,
      })
    } else {
      const wsUrl = getBrowserlessUrl()
      browser = await chromium.connect(wsUrl, {
        timeout: options.timeout ?? 60_000,
      })
      logApply('browser_transport', { transport: 'browserless' })
    }

    const viewport = getApplyBrowserViewport()
    const userAgent =
      process.env.BROWSER_APPLY_USER_AGENT?.trim() ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

    if (!attachedToExistingChrome) {
      const storageStatePath = resolveApplyStorageStatePath()
      context = await browser.newContext({
        viewport,
        screen: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        userAgent,
        locale: 'en-US',
        ...(storageStatePath ? { storageState: storageStatePath } : {}),
      })

      const injectedCookies = storageStatePath ? (await context.cookies()).length : 0
      logApply('browser_storage_state', {
        loaded: Boolean(storageStatePath),
        file: storageStatePath ? path.basename(storageStatePath) : undefined,
        contextCookieCount: injectedCookies,
      })
    }

    if (!context) throw new Error('No browser context')

    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    await page.setViewportSize(viewport)
    try {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await cdp.send('Network.setUserAgentOverride', { userAgent })
    } catch {
      // Best-effort; native connect should already honor viewport for screenshots
    }
    logApply('browser_viewport', {
      width: viewport.width,
      height: viewport.height,
      transport: 'playwright',
    })

    return await fn(page)
  } finally {
    const writePath = getApplyStorageStateWritePath()
    if (context && writePath) {
      await persistIndeedStorageStateAfterApply(context, writePath)
    }
    const visualWatch = attachedToExistingChrome || headedLocalChrome
    const pauseMs = pauseMsBeforeClose(visualWatch)
    if (pauseMs > 0 && browser) {
      logApply('browser_pause_before_close', {
        ms: pauseMs,
        note: 'Watch the Chrome window; set BROWSER_APPLY_PAUSE_MS_BEFORE_CLOSE=0 to skip',
      })
      await new Promise((r) => setTimeout(r, pauseMs))
    }
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
