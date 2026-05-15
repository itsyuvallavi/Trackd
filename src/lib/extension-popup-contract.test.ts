import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const popupSource = readFileSync(
  path.join(process.cwd(), 'browser-extension/scripts/popup.js'),
  'utf8',
)

function expectSourceContains(...snippets: string[]) {
  for (const snippet of snippets) {
    expect(popupSource).toContain(snippet)
  }
}

function extractFunctionSource(name: string): string {
  const functionStart = popupSource.indexOf(`function ${name}`)
  if (functionStart < 0) {
    throw new Error(`Function ${name} not found`)
  }
  const asyncPrefixStart = functionStart >= 6 ? functionStart - 6 : functionStart
  const start = popupSource.slice(asyncPrefixStart, functionStart) === 'async '
    ? asyncPrefixStart
    : functionStart

  const bodyStart = popupSource.indexOf('{', functionStart)
  let depth = 0
  for (let index = bodyStart; index < popupSource.length; index++) {
    const char = popupSource[index]
    if (char === '{') depth++
    if (char === '}') depth--
    if (depth === 0) return popupSource.slice(start, index + 1)
  }

  throw new Error(`Function ${name} did not terminate`)
}

function executablePopupHelpers(): {
  normalizeApiUrl: (value: unknown) => string
  parseApiJsonResponse: (response: Response) => Promise<Record<string, unknown>>
} {
  return new Function(`
    const DEFAULT_API_URL = 'https://trackd-eight.vercel.app';
    ${extractFunctionSource('normalizeApiUrl')}
    ${extractFunctionSource('parseApiJsonResponse')}
    return { normalizeApiUrl, parseApiJsonResponse };
  `)()
}

describe('browser extension popup contract', () => {
  it('validates extension keys through the extension API before persisting them', () => {
    expectSourceContains(
      "key.startsWith('tk_')",
      '/api/extension/validate-key',
      "method: 'POST'",
      "'Content-Type': 'application/json'",
      'JSON.stringify({ key })',
      'parseApiJsonResponse(res)',
      "chrome.storage.local.set({ extensionKey: key, userEmail: data.email })",
    )
  })

  it('sends save payloads with the extension key header and editable job fields', () => {
    expectSourceContains(
      '/api/extension/save-job',
      "'X-Extension-Key': extensionKey",
      'company: companyInput.value.trim()',
      'title: titleInput.value.trim()',
      'location: locationInput.value.trim()',
      'salary: salaryInput.value.trim()',
      "source: currentJobData?.source || 'Extension'",
      'parseApiJsonResponse(res)',
      'JSON.stringify(jobData)',
    )
  })

  it('allows local E2E to override the API origin without editing packaged code', () => {
    expectSourceContains(
      "const DEFAULT_API_URL = 'https://trackd-eight.vercel.app'",
      "chrome.storage.local.set({ trackdApiUrl: 'http://localhost:3001' })",
      "chrome.storage.local.get(['trackdApiUrl'])",
      'API_URL = normalizeApiUrl(data.trackdApiUrl)',
      'return url.origin',
    )
  })

  it('normalizes executable API origin overrides', () => {
    const { normalizeApiUrl } = executablePopupHelpers()

    expect(normalizeApiUrl('http://localhost:3001/some/path')).toBe('http://localhost:3001')
    expect(normalizeApiUrl('https://preview.trackd.test/path')).toBe('https://preview.trackd.test')
    expect(normalizeApiUrl('file:///tmp/trackd')).toBe('https://trackd-eight.vercel.app')
    expect(normalizeApiUrl('not a url')).toBe('https://trackd-eight.vercel.app')
  })

  it('turns empty or non-JSON API responses into stable popup errors', () => {
    expectSourceContains(
      'async function parseApiJsonResponse(response)',
      'const text = await response.text()',
      'if (!text.trim()) return {}',
      'JSON.parse(text)',
      'Trackd returned an invalid response.',
      'Trackd returned ${response.status} ${response.statusText',
    )
  })

  it('parses executable popup API responses defensively', async () => {
    const { parseApiJsonResponse } = executablePopupHelpers()

    await expect(parseApiJsonResponse(new Response('', { status: 200 }))).resolves.toEqual({})
    await expect(
      parseApiJsonResponse(new Response('{"ok":true}', { status: 200 })),
    ).resolves.toEqual({ ok: true })
    await expect(
      parseApiJsonResponse(new Response('<html>bad</html>', { status: 502, statusText: 'Bad Gateway' })),
    ).resolves.toEqual({ error: 'Trackd returned 502 Bad Gateway' })
  })

  it('handles duplicate saves without creating a second job flow', () => {
    expectSourceContains(
      'res.ok && data.job?.id',
      'Trackd saved the job but returned an invalid response.',
      'res.status === 409',
      "showMessage('warning', `Already saved on ${new Date(data.existingJob.savedAt).toLocaleDateString()}`)",
      'savedJobId = data.existingJob.id',
    )
  })

  it('clears persisted credentials when the save API rejects the extension key', () => {
    expectSourceContains(
      'res.status === 401',
      "chrome.storage.local.remove(['extensionKey', 'userEmail'])",
      "showMessage('error', 'Session expired. Please reconnect.')",
    )
  })

  it('keeps URL import authenticated and blocks LinkedIn server-side import', () => {
    expectSourceContains(
      "parsedUrl.hostname.includes('linkedin.com')",
      '/api/scrape-job',
      "'X-Extension-Key': extensionKey",
      'JSON.stringify({ url })',
      'parseApiJsonResponse(res)',
      'response.requiresClientSide',
    )
  })

  it('uses bounded network waits for connect, save, and URL import requests', () => {
    expectSourceContains('async function fetchWithTimeout')

    expect(popupSource).toMatch(
      /fetchWithTimeout\(`\$\{API_URL\}\/api\/extension\/validate-key`[\s\S]*?method: 'POST'/,
    )
    expect(popupSource).toMatch(
      /fetchWithTimeout\(`\$\{API_URL\}\/api\/extension\/save-job`[\s\S]*?method: 'POST'/,
    )
    expect(popupSource).toMatch(
      /fetchWithTimeout\(`\$\{API_URL\}\/api\/scrape-job`[\s\S]*?}, 15000\)/,
    )
  })
})
