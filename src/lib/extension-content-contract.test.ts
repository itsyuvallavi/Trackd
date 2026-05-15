import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const contentSource = readFileSync(
  path.join(process.cwd(), 'browser-extension/scripts/content.js'),
  'utf8',
)
const popupSource = readFileSync(
  path.join(process.cwd(), 'browser-extension/scripts/popup.js'),
  'utf8',
)

function expectContentContains(...snippets: string[]) {
  for (const snippet of snippets) {
    expect(contentSource).toContain(snippet)
  }
}

describe('browser extension content extraction contract', () => {
  it('responds to popup extraction messages asynchronously with debug metadata', () => {
    expectContentContains(
      'chrome.runtime.onMessage.addListener',
      "request.action === 'extractJobData'",
      'extractJobData().then(jobData =>',
      'jobData._debug = debugInfo',
      'sendResponse(jobData)',
      'return true',
    )
  })

  it('returns an empty payload instead of throwing when extraction fails', () => {
    expectContentContains(
      'function createEmptyData()',
      "title: ''",
      "company: ''",
      "location: ''",
      "salary: ''",
      "description: ''",
      'return createEmptyData()',
      'emptyData._debug = { ...debugInfo, error: error.message }',
    )
  })

  it('routes known boards to site extractors and keeps a universal fallback', () => {
    expectContentContains(
      "hostname: 'ziprecruiter.com'",
      "hostname: 'linkedin.com'",
      "hostname: 'landing.jobs'",
      "hostname: '4dayweek'",
      "hostname: 'remoterocketship.com'",
      'return extractUniversal()',
    )
  })

  it('bounds extracted descriptions before they reach the popup save payload', () => {
    expectContentContains(
      'MAX_DESCRIPTION_LENGTH: 2000',
      '.substring(0, CONSTANTS.MAX_DESCRIPTION_LENGTH)',
    )
  })

  it('allows extracted jobs into the popup form with a title, but requires company before save', () => {
    expect(popupSource).toContain('if (jobData && jobData.title)')
    expect(popupSource).toContain('if (!jobData.company || !jobData.title)')
    expect(popupSource).toContain("showMessage('error', 'Company and position are required')")
  })
})
