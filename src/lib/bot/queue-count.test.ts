import { describe, expect, it } from 'vitest'
import { countDedupedBotQueueJobs } from './queue-count'

describe('bot queue count', () => {
  it('matches queue dedupe by normalized company and title', () => {
    expect(
      countDedupedBotQueueJobs([
        { company: 'Acme', title: 'Frontend Engineer' },
        { company: ' acme ', title: ' frontend engineer ' },
        { company: 'Acme', title: 'Backend Engineer' },
      ]),
    ).toBe(2)
  })
})
