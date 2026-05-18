import * as XLSX from 'xlsx'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import excelRowsFixture from './__fixtures__/jobs-search-api-excel-rows.json'
import jsonSuccessFixture from './__fixtures__/jobs-search-api-json-success.json'
import { searchJobsSearchApiExcel } from './jobs-search-api-adapter'

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function workbookResponse(rows: Record<string, unknown>[]): Response {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Response(buffer, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })
}

describe('searchJobsSearchApiExcel provider contract', () => {
  beforeEach(() => {
    process.env.JOBS_SEARCH_COUNTRY_INDEED = 'Portugal'
    process.env.JOBS_SEARCH_SITE_NAMES = 'linkedin, glassdoor'
    process.env.JOBS_SEARCH_DISTANCE = '25'
    process.env.JOBS_SEARCH_HOURS_OLD = '48'
    process.env.JOBS_SEARCH_JOB_TYPE = 'contractor'
    process.env.JOBS_SEARCH_LINKEDIN_DESC = '1'
  })

  afterEach(() => {
    delete process.env.JOBS_SEARCH_COUNTRY_INDEED
    delete process.env.JOBS_SEARCH_SITE_NAMES
    delete process.env.JOBS_SEARCH_DISTANCE
    delete process.env.JOBS_SEARCH_HOURS_OLD
    delete process.env.JOBS_SEARCH_JOB_TYPE
    delete process.env.JOBS_SEARCH_LINKEDIN_DESC
    vi.unstubAllGlobals()
  })

  it('maps JSON rows, filters invalid jobs, infers boards, and sends POST settings', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(jsonSuccessFixture))
    vi.stubGlobal('fetch', fetchMock)

    const response = await searchJobsSearchApiExcel(
      {
        searchTerm: 'engineer',
        location: 'Remote Europe',
        resultsWanted: 150,
        isRemote: true,
        experienceHint: 'senior',
      },
      'test-rapidapi-key'
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, requestInit] = fetchMock.mock.calls[0]
    expect(url).toBe('https://jobs-search-api.p.rapidapi.com/getjobs_excel')
    expect(requestInit?.method).toBe('POST')
    expect(requestInit?.headers).toMatchObject({
      'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
      'x-rapidapi-key': 'test-rapidapi-key',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      search_term: 'senior engineer',
      location: 'remote europe',
      country_indeed: 'Portugal',
      results_wanted: 100,
      site_name: ['linkedin', 'glassdoor'],
      distance: 25,
      job_type: 'contractor',
      is_remote: true,
      linkedin_fetch_description: true,
      hours_old: 48,
    })

    expect(response.error).toBeUndefined()
    expect(response.jobs).toEqual([
      {
        title: 'Backend Engineer',
        company: 'Platform Co',
        location: 'Remote - US',
        url: 'https://jobs.example.com/platform/backend',
        description: 'Remote Node.js platform role.',
        salary_min: 130000,
        salary_max: 170000,
        salary_currency: 'USD',
        source: 'jobs_search_api',
        posted_date: '2026-05-10',
        job_type: 'Full-time',
        is_remote: true,
        company_logo: 'https://jobs.example.com/platform/logo.png',
        jobBoard: 'linkedin',
      },
      {
        title: 'QA Engineer',
        company: 'Quality Works',
        location: 'New York, NY',
        url: 'https://jobs.example.com/quality/qa',
        description: 'Test reliable product workflows.',
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        source: 'jobs_search_api',
        posted_date: null,
        job_type: null,
        is_remote: null,
        company_logo: null,
        jobBoard: 'zip_recruiter',
      },
    ])
  })

  it('maps Excel rows with provider column aliases and filters invalid rows', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(workbookResponse(excelRowsFixture as Record<string, unknown>[]))
    vi.stubGlobal('fetch', fetchMock)

    const response = await searchJobsSearchApiExcel(
      {
        searchTerm: 'analyst',
        location: 'Boston',
        resultsWanted: 5,
        isRemote: false,
      },
      'test-rapidapi-key'
    )

    expect(response.error).toBeUndefined()
    expect(response.jobs).toEqual([
      {
        title: 'Data Analyst',
        company: 'Numbers Inc',
        location: 'Boston, MA',
        url: 'https://jobs.example.com/numbers/data-analyst',
        description: 'Analyze product usage data.',
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        source: 'jobs_search_api',
        posted_date: null,
        job_type: null,
        is_remote: null,
        company_logo: null,
        jobBoard: 'glassdoor',
      },
    ])
  })

  it('does not duplicate an experience hint already present in the search term', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await searchJobsSearchApiExcel(
      {
        searchTerm: 'Senior frontend engineer',
        location: '',
        resultsWanted: 0,
        isRemote: false,
        experienceHint: 'senior',
      },
      'test-rapidapi-key'
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.search_term).toBe('Senior frontend engineer')
    expect(body.location).toBe('remote')
    expect(body.results_wanted).toBe(1)
  })

  it('lets caller override country and LinkedIn description settings per pass', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await searchJobsSearchApiExcel(
      {
        searchTerm: 'Frontend Engineer remote Europe',
        location: 'Europe',
        resultsWanted: 5,
        isRemote: true,
        countryIndeed: 'Portugal',
        linkedinFetchDescription: true,
        siteNames: ['linkedin', 'glassdoor'],
      },
      'test-rapidapi-key'
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body).toMatchObject({
      country_indeed: 'Portugal',
      is_remote: true,
      linkedin_fetch_description: true,
      site_name: ['linkedin', 'glassdoor'],
    })
  })
})
