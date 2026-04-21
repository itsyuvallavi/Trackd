'use client'

import { useRef, useState, useTransition } from 'react'
import { updateApplicationProfile } from '@/app/(authenticated)/profile/actions'
import { CheckCircle } from 'lucide-react'
import type { ApplicationProfile } from '@prisma/client'

/** Password is never sent to the client; `hasPortalSignupPassword` indicates one is stored. */
export type ApplicationProfileFormProps = Omit<ApplicationProfile, 'portalSignupPassword'> & {
  hasPortalSignupPassword?: boolean
}

interface Props {
  profile: ApplicationProfileFormProps | null
}

const inputCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

const labelCls = 'block text-xs font-medium text-muted-foreground uppercase mb-1'

const WORK_AUTH_OPTIONS = [
  { value: '', label: 'Select…' },
  // EU / Global
  { value: 'eu_citizen', label: 'EU / EEA Citizen (full rights)' },
  { value: 'eu_resident', label: 'EU Residence Permit' },
  { value: 'pt_resident', label: 'Portugal — Resident / NHR' },
  { value: 'uk_citizen', label: 'UK Citizen / Settled Status' },
  { value: 'schengen_visa', label: 'Schengen Visa / Work Permit' },
  // US
  { value: 'us_citizen', label: 'US Citizen' },
  { value: 'green_card', label: 'US Green Card / Permanent Resident' },
  { value: 'h1b', label: 'H-1B Visa' },
  { value: 'ead', label: 'EAD (OPT/CPT/H4)' },
  // Other
  { value: 'other', label: 'Other / Not listed' },
]

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
      {/* Identity for auto-apply / job-board signup */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Application identity
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Used by the apply bot for your legal name, email, and optional host job-board password (signup
          gates). The bot still will not click final &quot;Sign up&quot; — you confirm from the screenshot.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Legal name</label>
            <input
              type="text"
              name="applicationFullName"
              defaultValue={profile?.applicationFullName ?? ''}
              placeholder="As on ID / applications"
              className={inputCls}
              autoComplete="name"
            />
          </div>
          <div>
            <label className={labelCls}>Application email</label>
            <input
              type="email"
              name="applicationEmail"
              defaultValue={profile?.applicationEmail ?? ''}
              placeholder="you@example.com"
              className={inputCls}
              autoComplete="email"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Host job-board password (optional)</label>
            <input
              type="password"
              name="portalSignupPassword"
              placeholder={
                profile?.hasPortalSignupPassword
                  ? 'Leave blank to keep current password'
                  : 'Unique password for job-board signups only'
              }
              className={inputCls}
              autoComplete="new-password"
            />
            {profile?.hasPortalSignupPassword ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" name="clearPortalSignupPassword" className="rounded border-border" />
                Remove saved job-board password
              </label>
            ) : null}
          </div>
        </div>
      </div>

      {/* Contact & Location */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Contact &amp; Location
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone</label>
            <input
              type="tel"
              name="phone"
              defaultValue={profile?.phone ?? ''}
              placeholder="+351 900 000 000"
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
          <div>
            <label className={labelCls}>City</label>
            <input
              type="text"
              name="city"
              defaultValue={profile?.city ?? ''}
              placeholder="Lisbon"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Region / State (optional)</label>
            <input
              type="text"
              name="state"
              defaultValue={profile?.state ?? ''}
              placeholder="Lisboa"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Country</label>
            <input
              type="text"
              name="country"
              defaultValue={profile?.country ?? ''}
              placeholder="Portugal"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Street Address (optional)</label>
            <input
              type="text"
              name="address"
              defaultValue={profile?.address ?? ''}
              placeholder="Rua Example 123"
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
          <div className="sm:col-span-2">
            <label className={labelCls}>Status</label>
            <select
              name="workAuthorization"
              defaultValue={profile?.workAuthorization ?? ''}
              className={inputCls}
            >
              {WORK_AUTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Requires Visa Sponsorship?</label>
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
            <label className={labelCls}>Salary Expectation (annual, gross)</label>
            <div className="relative">
              <input
                type="number"
                name="salaryExpectation"
                defaultValue={profile?.salaryExpectation ?? ''}
                placeholder="80000"
                min={0}
                step={1000}
                className={inputCls}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                EUR/year
              </span>
            </div>
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
