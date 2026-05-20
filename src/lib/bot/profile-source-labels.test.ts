import { describe, expect, it } from 'vitest'
import {
  profileSourceLabel,
  resolveResumeReadinessSource,
} from './profile-source-labels'

describe('profile source labels', () => {
  it('labels parsed resume scoring as ready and resume-backed', () => {
    expect(
      resolveResumeReadinessSource({
        totalCount: 2,
        parsedCount: 1,
        rawTextCount: 0,
        hasIdentityFallback: true,
      })
    ).toMatchObject({
      kind: 'parsed_resume',
      label: 'Parsed resume',
      tone: 'ready',
      isResumeBacked: true,
      requiresResumeWarning: false,
    })
  })

  it('labels raw resume text as a limited resume fallback', () => {
    expect(
      resolveResumeReadinessSource({
        totalCount: 1,
        parsedCount: 0,
        rawTextCount: 1,
        hasIdentityFallback: true,
      })
    ).toMatchObject({
      kind: 'raw_resume_fallback',
      label: 'Raw resume fallback',
      tone: 'limited',
      isResumeBacked: true,
      requiresResumeWarning: false,
    })
  })

  it('warns when Job Search can only use Application Identity fallback', () => {
    expect(
      resolveResumeReadinessSource({
        totalCount: 0,
        parsedCount: 0,
        rawTextCount: 0,
        hasIdentityFallback: true,
      })
    ).toMatchObject({
      kind: 'application_identity_fallback',
      label: 'Application Identity fallback',
      tone: 'limited',
      isResumeBacked: false,
      requiresResumeWarning: true,
    })
  })

  it('warns when only search settings are available', () => {
    expect(
      resolveResumeReadinessSource({
        totalCount: 0,
        parsedCount: 0,
        rawTextCount: 0,
        hasIdentityFallback: false,
      })
    ).toMatchObject({
      kind: 'settings_fallback',
      label: 'Search settings fallback',
      tone: 'missing',
      isResumeBacked: false,
      requiresResumeWarning: true,
    })
  })

  it('has stable user-facing labels for persisted scoring metadata', () => {
    expect(profileSourceLabel('parsed_resume')).toBe('Parsed resume')
    expect(profileSourceLabel('raw_resume_fallback')).toBe('Raw resume fallback')
    expect(profileSourceLabel('application_identity_fallback')).toBe(
      'Application Identity fallback'
    )
  })
})
