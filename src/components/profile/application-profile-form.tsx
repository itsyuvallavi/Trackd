'use client'

import { useRef, useState, useTransition } from 'react'
import { updateApplicationProfile } from '@/app/(authenticated)/profile/actions'
import { CheckCircle } from 'lucide-react'
import type { ApplicationProfile } from '@prisma/client'

interface Props {
  profile: ApplicationProfile | null
}

const inputCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

const labelCls = 'block text-xs font-medium text-muted-foreground uppercase mb-1'

export function ApplicationProfileForm({ profile }: Props) {
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateApplicationProfile(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Contact */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Contact
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone</label>
            <input
              type="tel"
              name="phone"
              defaultValue={profile?.phone ?? ''}
              placeholder="+1 (555) 000-0000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Years of Experience</label>
            <input
              type="number"
              name="yearsExperience"
              defaultValue={profile?.yearsExperience ?? ''}
              placeholder="5"
              min={0}
              max={50}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Street Address</label>
            <input
              type="text"
              name="address"
              defaultValue={profile?.address ?? ''}
              placeholder="123 Main St"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input
              type="text"
              name="city"
              defaultValue={profile?.city ?? ''}
              placeholder="San Francisco"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input
              type="text"
              name="state"
              defaultValue={profile?.state ?? ''}
              placeholder="CA"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Country</label>
            <input
              type="text"
              name="country"
              defaultValue={profile?.country ?? 'United States'}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Online Presence */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Online Presence
        </p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>LinkedIn URL</label>
            <input
              type="url"
              name="linkedinUrl"
              defaultValue={profile?.linkedinUrl ?? ''}
              placeholder="https://linkedin.com/in/yourname"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>GitHub URL</label>
            <input
              type="url"
              name="githubUrl"
              defaultValue={profile?.githubUrl ?? ''}
              placeholder="https://github.com/yourname"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Portfolio / Website</label>
            <input
              type="url"
              name="portfolioUrl"
              defaultValue={profile?.portfolioUrl ?? ''}
              placeholder="https://yoursite.com"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Work Authorization */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Work Authorization
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select
              name="workAuthorization"
              defaultValue={profile?.workAuthorization ?? ''}
              className={inputCls}
            >
              <option value="">Select…</option>
              <option value="us_citizen">US Citizen</option>
              <option value="green_card">Green Card / Permanent Resident</option>
              <option value="h1b">H-1B Visa</option>
              <option value="ead">EAD (OPT/CPT/H4)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Requires Sponsorship?</label>
            <select
              name="requiresSponsorship"
              defaultValue={profile?.requiresSponsorship ? 'true' : 'false'}
              className={inputCls}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Application Preferences */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Application Preferences
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Salary Expectation (USD / year)</label>
            <input
              type="number"
              name="salaryExpectation"
              defaultValue={profile?.salaryExpectation ?? ''}
              placeholder="120000"
              min={0}
              step={1000}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Notice Period</label>
            <select
              name="noticePeriod"
              defaultValue={profile?.noticePeriod ?? ''}
              className={inputCls}
            >
              <option value="">Select…</option>
              <option value="immediately">Immediately available</option>
              <option value="2_weeks">2 weeks</option>
              <option value="1_month">1 month</option>
              <option value="3_months">3 months</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save application profile'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="size-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  )
}
