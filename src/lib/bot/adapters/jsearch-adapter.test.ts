import { afterEach, describe, expect, it, vi } from 'vitest'

import jsearchEmptyFixture from './__fixtures__/jsearch-empty.json'
import jsearchSuccessFixture from './__fixtures__/jsearch-success.json'
import { searchJSearch } from './jsearch-adapter'

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('searchJSearch provider contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps JSearch jobs and sends search/filter settings to RapidAPI', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(jsearchSuccessFixture))
      .mockResolvedValueOnce(jsonResponse(jsearchEmptyFixture))
    vi.stubGlobal('fetch', fetchMock)

    const response = await searchJSearch(
      {
        query: 'Frontend Engineer',
        location: 'Austin',
        remoteOnly: true,
        employmentType: 'FULLTIME',
        datePosted: '3days',
        numPages: 3,
        excludeJobPublishers: ['Blocked Board', 'Staffing Inc'],
        jobRequirements: 'more_than_3_years_experience',
      },
      'test-rapidapi-key'
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(firstUrl.origin).toBe('https://jsearch.p.rapidapi.com')
    expect(firstUrl.pathname).toBe('/search')
    expect(firstUrl.searchParams.get('query')).toBe('Frontend Engineer remote')
    expect(firstUrl.searchParams.get('page')).toBe('1')
    expect(firstUrl.searchParams.get('num_pages')).toBe('1')
    expect(firstUrl.searchParams.get('date_posted')).toBe('3days')
    expect(firstUrl.searchParams.get('remote_jobs_only')).toBe('true')
    expect(firstUrl.searchParams.get('employment_types')).toBe('FULLTIME')
    expect(firstUrl.searchParams.get('job_requirements')).toBe('more_than_3_years_experience')
    expect(firstUrl.searchParams.get('exclude_job_publishers')).toBe('Blocked Board,Staffing Inc')

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(requestInit.headers).toMatchObject({
      'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      'x-rapidapi-key': 'test-rapidapi-key',
    })

    expect(response.error).toBeUndefined()
    expect(response.jobs).toEqual([
      {
        title: 'Senior Frontend Engineer',
        company: 'Acme Labs',
        location: 'Austin, TX, US',
        url: 'https://jobs.example.com/acme/frontend',
        description: 'Build React and TypeScript products for remote-friendly teams.',
        salary_min: 120000,
        salary_max: 155000,
        salary_currency: 'USD',
        source: 'jsearch',
        posted_date: '2026-05-12',
        job_type: 'FULLTIME',
        is_remote: true,
        company_logo: 'https://jobs.example.com/acme/logo.png',
      },
      {
        title: 'Product Designer',
        company: 'Design Co',
        location: 'US',
        url: null,
        description: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        source: 'jsearch',
        posted_date: null,
        job_type: null,
        is_remote: false,
        company_logo: null,
      },
    ])
  })

  it('uses location queries when remote-only is disabled', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(jsearchEmptyFixture))
    vi.stubGlobal('fetch', fetchMock)

    const response = await searchJSearch(
      {
        query: 'Product Manager',
        location: 'New York',
        remoteOnly: false,
        numPages: 1,
      },
      'test-rapidapi-key'
    )

    expect(response).toEqual({ jobs: [] })
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('query')).toBe('Product Manager in New York')
    expect(url.searchParams.has('remote_jobs_only')).toBe(false)
  })
})
