'use client'

import { useState, useRef, useTransition } from 'react'
import { Trash2, Upload, FileText, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

interface BotResume {
  id: string
  label: string
  matchKeywords: string[]
  isDefault: boolean
  fileName: string
  fileUrl: string
  structuredData: ResumeStructuredData | null
  createdAt: string
}

interface BotResumeManagerProps {
  initialResumes: BotResume[]
}

export function BotResumeManager({ initialResumes }: BotResumeManagerProps) {
  const [resumes, setResumes] = useState<BotResume[]>(initialResumes)
  const [isUploading, startUpload] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Upload form state
  const [label, setLabel] = useState('')
  const [keywords, setKeywords] = useState('')
  const [isDefault, setIsDefault] = useState(resumes.length === 0)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function flashMessage(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(''), 5000) }
    else { setMessage(msg); setTimeout(() => setMessage(''), 5000) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.pdf')) { flashMessage('Only PDF files are supported', true); return }
    if (f.size > 5 * 1024 * 1024) { flashMessage('File too large (max 5MB)', true); return }
    setFile(f)
    if (!label) setLabel(f.name.replace(/\.pdf$/i, '').replace(/_/g, ' '))
  }

  function handleUpload() {
    if (!file) { flashMessage('Select a PDF file first', true); return }
    if (!label.trim()) { flashMessage('Add a label (e.g. "Software Engineer")', true); return }

    startUpload(async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('label', label.trim())
      fd.append('matchKeywords', keywords)
      fd.append('isDefault', String(isDefault))

      const res = await fetch('/api/bot/resumes', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        flashMessage(data.error ?? 'Upload failed', true)
        return
      }

      const newResume = await res.json() as BotResume
      setResumes((prev) => {
        const updated = isDefault ? prev.map((r) => ({ ...r, isDefault: false })) : prev
        return [...updated, newResume]
      })
      setLabel('')
      setKeywords('')
      setFile(null)
      setIsDefault(false)
      if (fileRef.current) fileRef.current.value = ''
      flashMessage(`"${newResume.label}" uploaded and parsed successfully`)
    })
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      const res = await fetch(`/api/bot/resumes?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { flashMessage('Delete failed', true); return }
      setResumes((prev) => prev.filter((r) => r.id !== id))
    })
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm">Resumes</h2>
        <span className="text-xs text-muted-foreground">{resumes.length} uploaded</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload one resume per job type. The bot picks the best match based on keywords in the job title.
        For example: "Software Engineer" resume for engineering roles, "Product Manager" for PM roles.
      </p>

      {/* Existing resumes */}
      {resumes.length > 0 && (
        <div className="space-y-2">
          {resumes.map((resume) => {
            const isExpanded = expandedId === resume.id
            const sd = resume.structuredData
            return (
              <div key={resume.id} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{resume.label}</span>
                      {resume.isDefault && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                          <Star className="size-2.5 fill-current" /> default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{resume.fileName}</p>
                    {resume.matchKeywords.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Triggers on: {resume.matchKeywords.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {sd && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : resume.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={isExpanded ? 'Collapse' : 'View parsed data'}
                      >
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    )}
                    <a
                      href={resume.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(resume.id)}
                      disabled={isDeleting}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                      aria-label="Delete resume"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded parsed data */}
                {isExpanded && sd && (
                  <div className="border-t border-border px-3 py-3 bg-muted/30 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {sd.name && <p><span className="text-muted-foreground">Name:</span> {sd.name}</p>}
                      {sd.email && <p><span className="text-muted-foreground">Email:</span> {sd.email}</p>}
                      {sd.phone && <p><span className="text-muted-foreground">Phone:</span> {sd.phone}</p>}
                      {sd.location && <p><span className="text-muted-foreground">Location:</span> {sd.location}</p>}
                      {sd.linkedin && <p><span className="text-muted-foreground">LinkedIn:</span> <a href={sd.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Profile</a></p>}
                      {sd.github && <p><span className="text-muted-foreground">GitHub:</span> <a href={sd.github} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Profile</a></p>}
                    </div>
                    {sd.skills.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1">Skills:</p>
                        <div className="flex flex-wrap gap-1">
                          {sd.skills.slice(0, 20).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{s}</span>
                          ))}
                          {sd.skills.length > 20 && <span className="text-muted-foreground">+{sd.skills.length - 20} more</span>}
                        </div>
                      </div>
                    )}
                    {sd.experience.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1">Experience:</p>
                        {sd.experience.slice(0, 3).map((e, i) => (
                          <p key={i} className="text-foreground/80">
                            {e.title} @ {e.company} ({e.startDate}–{e.endDate})
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Upload form */}
      <div className="border border-dashed border-border rounded-lg p-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Add resume</p>

        <div>
          <label className="block text-xs font-medium mb-1">Label *</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='e.g. "Software Engineer" or "Product Manager"'
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Job title keywords (triggers this resume)</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder='e.g. "engineer, developer, frontend, backend"'
            className={inputClass}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Comma-separated. Leave blank to use as default.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isDefault"
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="isDefault" className="text-xs">Use as default when no keywords match</label>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            id="resume-file-input"
          />
          <label
            htmlFor="resume-file-input"
            className={cn(
              'flex items-center gap-2 px-3 py-2 border border-border rounded text-sm cursor-pointer',
              'hover:bg-muted transition-colors',
              file ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Upload className="size-4" />
            {file ? file.name : 'Choose PDF file (max 5MB)'}
          </label>
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading || !file || !label.trim()}
          className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <span className="inline-block size-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Uploading &amp; parsing…
            </>
          ) : (
            'Upload &amp; parse resume'
          )}
        </button>

        {isUploading && (
          <p className="text-xs text-muted-foreground text-center">
            AI is extracting your info from the PDF — this takes ~15 seconds
          </p>
        )}
      </div>

      {message && <p className="text-xs text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
