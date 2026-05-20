import { describe, expect, it } from 'vitest'

import {
  profileSourceFromScoringInputs,
  summarizeProfileSources,
} from './cached-queries'

describe('bot run profile source summaries', () => {
  it('reads canonical profileSource metadata', () => {
    expect(
      profileSourceFromScoringInputs({
        profileSource: {
          kind: 'parsed_resume',
          label: 'Parsed resume',
          resumeLabel: 'Main resume',
          applicationIdentitySupplemented: true,
          settingsDerivedSignalsUsed: false,
          limitations: [],
        },
      })
    ).toEqual({
      kind: 'parsed_resume',
      label: 'Parsed resume',
      resumeLabel: 'Main resume',
      applicationIdentitySupplemented: true,
      settingsDerivedSignalsUsed: false,
      limitations: [],
    })
  })

  it('maps legacy resumeUsed selections so old successful runs remain debuggable', () => {
    expect(
      profileSourceFromScoringInputs({
        resumeUsed: {
          resumeId: 'resume_1',
          label: 'Yuval Lavi Resume Final Cleaned',
          selection: 'matched_by_keywords',
        },
      })
    ).toEqual({
      kind: 'parsed_resume',
      label: 'Parsed resume',
      resumeLabel: 'Yuval Lavi Resume Final Cleaned',
      applicationIdentitySupplemented: false,
      settingsDerivedSignalsUsed: false,
      limitations: ['Legacy run metadata did not include full profile-source diagnostics.'],
    })
  })

  it('summarizes matching sources across listing rows', () => {
    expect(
      summarizeProfileSources([
        {
          scoringInputs: {
            profileSource: {
              kind: 'parsed_resume',
              label: 'Parsed resume',
              resumeLabel: 'Main resume',
            },
          },
        },
        {
          scoringInputs: {
            resumeUsed: {
              resumeId: 'resume_1',
              label: 'Main resume',
              selection: 'matched_by_keywords',
            },
          },
        },
        {
          scoringInputs: {
            note: 'AI evaluator was not run for this listing.',
          },
        },
      ])
    ).toEqual([
      expect.objectContaining({
        kind: 'parsed_resume',
        resumeLabel: 'Main resume',
        listings: 2,
      }),
    ])
  })
})
