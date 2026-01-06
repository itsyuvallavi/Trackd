'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { scrapeJobUrl, ScrapedJobData } from '../scrape-actions'
import { createJob } from '../actions'
import { Button } from '@/components/ui/button'
import { JobSource, JobStatus, JobPriority } from '@prisma/client'
import { SOURCE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants'

export default function NewUrlPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [isScaping, setIsScraping] = useState(false)
  const [scrapedData, setScrapedData] = useState<ScrapedJobData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Form state for editing scraped data
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    source: 'MANUAL' as JobSource,
    status: 'SAVED' as JobStatus,
    priority: 'B' as JobPriority,
    notes: '',
    salary: '',
    contactName: '',
    contactEmail: '',
    nextAction: '',
    url: '',
  })

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setScrapedData(null)
    setIsScraping(true)

    try {
      const result = await scrapeJobUrl(url)

      if (result.success && result.data) {
        setScrapedData(result.data)
        setFormData({
          title: result.data.title,
          company: result.data.company,
          location: result.data.location || '',
          source: result.data.source,
          status: 'SAVED',
          priority: 'B',
          notes: result.data.description || '',
          salary: result.data.salary || '',
          contactName: '',
          contactEmail: '',
          nextAction: '',
          url: result.data.url,
        })
      } else {
        setError(result.error || 'Failed to scrape job URL')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsScraping(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const formDataObj = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      formDataObj.append(key, value)
    })

    startTransition(async () => {
      try {
        await createJob(formDataObj)
        router.push('/jobs')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create job')
      }
    })
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 md:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-2">Add Job from URL</h1>
            <p className="text-sm text-muted-foreground">
              Paste a job URL and we&apos;ll try to extract the details automatically.
            </p>
          </div>

        {/* URL Input Form */}
        {!scrapedData && (
          <form onSubmit={handleScrape} className="mb-8">
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/..."
                className="flex-1 rounded-md border border-foreground/20 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                required
                disabled={isScaping}
              />
              <Button type="submit" disabled={isScaping || !url}>
                {isScaping ? 'Scraping...' : 'Scrape Job'}
              </Button>
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
                {error}
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setError(null)
                      setFormData({
                        ...formData,
                        title: '',
                        company: '',
                        url: url,
                      })
                      setScrapedData({} as ScrapedJobData)
                    }}
                  >
                    Enter manually instead
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Scraped Data Preview & Edit Form */}
        {scrapedData && (
          <div>
            <div className="mb-4 rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
              Job details scraped successfully! Review and edit below before saving.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  />
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium mb-1">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    required
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  />
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  />
                </div>

                <div>
                  <label htmlFor="source" className="block text-sm font-medium mb-1">
                    Source
                  </label>
                  <select
                    id="source"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as JobSource })}
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  >
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as JobStatus })}
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium mb-1">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as JobPriority })}
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="salary" className="block text-sm font-medium mb-1">
                    Salary
                  </label>
                  <input
                    type="text"
                    id="salary"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  />
                </div>

                <div>
                  <label htmlFor="nextAction" className="block text-sm font-medium mb-1">
                    Next Action
                  </label>
                  <input
                    type="text"
                    id="nextAction"
                    value={formData.nextAction}
                    onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={12}
                  className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setScrapedData(null)
                    setFormData({
                      title: '',
                      company: '',
                      location: '',
                      source: 'MANUAL',
                      status: 'SAVED',
                      priority: 'B',
                      notes: '',
                      salary: '',
                      contactName: '',
                      contactEmail: '',
                      nextAction: '',
                      url: '',
                    })
                  }}
                  disabled={isPending}
                >
                  Start Over
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save Job'}
                </Button>
              </div>
            </form>
          </div>
        )}
        </div>
      </div>
    </AppShell>
  )
}
