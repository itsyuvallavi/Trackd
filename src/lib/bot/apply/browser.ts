/**
 * Browserless.io connection manager.
 * Connects Playwright to a remote Chrome instance instead of launching locally.
 * Vercel serverless functions can't spawn browsers — Browserless runs Chrome for us.
 */

import { chromium, type Browser, type Page } from 'playwright-core'

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

    const result = await fn(page)
    return result
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
