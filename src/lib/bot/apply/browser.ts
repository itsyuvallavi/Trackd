/**
 * Browserless.io connection manager.
 * Playwright is required only inside withBrowser() so this module is safe to
 * import from the graph without executing native code at load time.
 */

import type { Browser, Page } from 'playwright-core'

const BROWSERLESS_WS = 'wss://production-sfo.browserless.io'

export function getBrowserlessUrl(): string {
  const key = process.env.BROWSERLESS_API_KEY
  if (!key) throw new Error('BROWSERLESS_API_KEY is not set')
  return `${BROWSERLESS_WS}?token=${key}`
}

export async function withBrowser<T>(
  fn: (page: Page) => Promise<T>,
  options: { timeout?: number } = {}
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('playwright-core') as typeof import('playwright-core')

  const wsUrl = getBrowserlessUrl()
  let browser: Browser | null = null

  try {
    browser = await chromium.connectOverCDP(wsUrl, {
      timeout: options.timeout ?? 60_000,
    })

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    })

    const page = await context.newPage()
    page.setDefaultTimeout(30_000)

    return await fn(page)
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
