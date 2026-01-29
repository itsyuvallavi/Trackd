import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { ResumeAdvisorContent } from '@/components/resume/resume-advisor-content'

export const revalidate = 60

export default async function ResumeAdvisorPage() {
  await requireAuth()

  return (
    <AppShell>
      <ResumeAdvisorContent />
    </AppShell>
  )
}

