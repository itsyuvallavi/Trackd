import type { ComponentProps } from 'react'
import { requireAuth } from '@/lib/auth'
import { getBotResumesList } from '@/lib/cached-queries'
import { BotResumeManager } from '@/components/bot/bot-resume-manager'
import { sanitizeJsonClone, serializeForClient } from '@/lib/serialize-for-client'

export const metadata = { title: 'Job Search resumes — Trackd' }

type BotResumeManagerResumes = ComponentProps<typeof BotResumeManager>['initialResumes']

export default async function BotResumesPage() {
  const user = await requireAuth()

  const resumes = await getBotResumesList(user.id)

  const resumesSafe = resumes.map((r) => ({
    ...r,
    structuredData: sanitizeJsonClone(r.structuredData),
  }))

  return (
    <section>
      <header className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">Resumes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload the resumes the apply bot can send. The default is used when
          no better match is found.
        </p>
      </header>
      <BotResumeManager
        initialResumes={
          serializeForClient(resumesSafe).map((r) => ({
            ...r,
            structuredData:
              r.structuredData as import('@/lib/bot/resume/types').ResumeStructuredData | null,
          })) as unknown as BotResumeManagerResumes
        }
      />
    </section>
  )
}
