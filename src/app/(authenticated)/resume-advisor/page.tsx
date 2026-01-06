import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { ResumeAdvisorContent } from '@/components/resume/resume-advisor-content'

export const revalidate = 60

export default async function ResumeAdvisorPage() {
  await requireAuth()

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-4 md:px-8 py-4 md:py-6">
          <div className="w-full max-w-[1200px]">
            <ResumeAdvisorContent />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

