import { describe, expect, it } from 'vitest'
import { isActiveApplicationStatus } from './job-status-groups'

describe('job status groups', () => {
  it('keeps saved jobs out of active applications', () => {
    expect(isActiveApplicationStatus('SAVED')).toBe(false)
    expect(isActiveApplicationStatus('APPLIED')).toBe(true)
    expect(isActiveApplicationStatus('INTERVIEW')).toBe(true)
    expect(isActiveApplicationStatus('OFFER')).toBe(true)
    expect(isActiveApplicationStatus('REJECTED')).toBe(false)
    expect(isActiveApplicationStatus('ARCHIVED')).toBe(false)
  })
})
