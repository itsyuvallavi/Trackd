import { test, expect } from '@playwright/test'

test.describe('extension API contract', () => {
  test('save-job rejects unauthenticated extension requests', async ({ request }) => {
    const response = await request.post('/api/extension/save-job', {
      data: {
        key: 'tk_test00000000000000000000000000000000',
        job: {
          title: 'E2E Test Engineer',
          company: 'Trackd QA',
          url: 'https://example.com/jobs/e2e',
          source: 'other',
        },
      },
    })

    expect([401, 400, 500]).toContain(response.status())
  })

  test('save-job rejects missing job payload', async ({ request }) => {
    const response = await request.post('/api/extension/save-job', {
      data: { key: 'tk_invalid' },
    })

    expect([400, 401]).toContain(response.status())
  })
})
