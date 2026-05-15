import { describe, expect, it } from 'vitest'
import { JobSource } from '@prisma/client'
import {
  hashExtensionKey,
  isValidExtensionKeyFormat,
  mapExtensionSourceToJobSource,
  sanitizeExtensionJobPayload,
} from './extension-jobs'

describe('extension job helpers', () => {
  it('validates extension key format and hashes keys deterministically', () => {
    const validKey = `tk_${'a'.repeat(32)}`

    expect(isValidExtensionKeyFormat(validKey)).toBe(true)
    expect(isValidExtensionKeyFormat('tk_abc')).toBe(false)
    expect(isValidExtensionKeyFormat('abc')).toBe(false)
    expect(hashExtensionKey(validKey)).toBe(hashExtensionKey(validKey))
    expect(hashExtensionKey(validKey)).not.toBe(validKey)
  })

  it('maps extension source labels to job sources', () => {
    expect(mapExtensionSourceToJobSource('LinkedIn')).toBe(JobSource.LINKEDIN)
    expect(mapExtensionSourceToJobSource('EU Remote Jobs')).toBe(JobSource.EU_REMOTE_JOBS)
    expect(mapExtensionSourceToJobSource('Landing.jobs')).toBe(JobSource.LANDING_JOBS)
    expect(mapExtensionSourceToJobSource('unknown')).toBe(JobSource.OTHER)
  })

  it('sanitizes valid payloads with length limits', () => {
    const result = sanitizeExtensionJobPayload({
      company: ` ${'A'.repeat(250)} `,
      title: ` ${'T'.repeat(350)} `,
      location: ' Remote ',
      url: ' https://example.com/job ',
      salary: '$100k',
      source: 'ZipRecruiter',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.company).toHaveLength(200)
      expect(result.data.title).toHaveLength(300)
      expect(result.data.location).toBe('Remote')
      expect(result.data.url).toBe('https://example.com/job')
      expect(result.data.source).toBe(JobSource.ZIPRECRUITER)
    }
  })

  it('rejects missing required fields and unsafe URLs', () => {
    expect(sanitizeExtensionJobPayload({ company: 'Acme' })).toEqual({
      ok: false,
      status: 400,
      error: 'Title is required',
    })
    expect(sanitizeExtensionJobPayload({ company: ' ', title: 'Engineer' })).toEqual({
      ok: false,
      status: 400,
      error: 'Company and title cannot be empty',
    })
    expect(
      sanitizeExtensionJobPayload({
        company: 'Acme',
        title: 'Engineer',
        url: 'javascript:alert(1)',
      }),
    ).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid URL protocol',
    })
  })
})
