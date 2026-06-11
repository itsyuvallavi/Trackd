'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { BotConfig } from '@prisma/client'
import { BotResumeManager } from '@/components/bot/bot-resume-manager'
import { BotSettingsContent } from '@/components/bot/bot-settings-content'
import type { BotSearchBackends, BotSearchUiCaps } from '@/lib/bot/search-preview'
import type { SetupReadiness } from '@/lib/bot/setup-readiness'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'
import { setupPanelClass } from '@/components/bot/setup-ui'

type BotResumeRow = {
  id: string
  label: string
  matchKeywords: string[]
  isDefault: boolean
  fileName: string
  fileUrl: string
  structuredData: ResumeStructuredData | null
  createdAt: string
}

export type BotSetupContentProps = {
  initialConfig: BotConfig | null
  initialResumes: BotResumeRow[]
  setupReadiness: SetupReadiness
  telegramConfigured: boolean
  searchServiceConfigured: boolean
  searchBackends: BotSearchBackends
  safeResumeSearchTerms: string[]
  allResumeSearchTerms: string[]
  searchUiCaps: BotSearchUiCaps
}

const SECTIONS = ['resume', 'search'] as const
type SetupSection = (typeof SECTIONS)[number]

function isSetupSection(value: string | null): value is SetupSection {
  return value != null && (SECTIONS as readonly string[]).includes(value)
}

export function BotSetupContent({
  initialConfig,
  initialResumes,
  setupReadiness,
  telegramConfigured,
  searchServiceConfigured,
  searchBackends,
  safeResumeSearchTerms,
  allResumeSearchTerms,
  searchUiCaps,
}: BotSetupContentProps) {
  const searchParams = useSearchParams()
  const scrolledRef = useRef(false)

  useEffect(() => {
    if (scrolledRef.current) return
    const section = searchParams.get('section')
    if (!isSetupSection(section)) return
    scrolledRef.current = true
    const el = document.getElementById(section)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [searchParams])

  return (
    <div>
      {setupReadiness.isComplete && (
        <p className="mb-3 text-xs text-muted-foreground">
          Ready —{' '}
          <Link href="/bot" className="font-medium text-foreground underline-offset-2 hover:underline">
            open Queue
          </Link>{' '}
          to run a search.
        </p>
      )}

      <div className={setupPanelClass}>
        <BotSettingsContent
          layout="setup"
          initialConfig={initialConfig}
          telegramConfigured={telegramConfigured}
          searchServiceConfigured={searchServiceConfigured}
          searchBackends={searchBackends}
          safeResumeSearchTerms={safeResumeSearchTerms}
          allResumeSearchTerms={allResumeSearchTerms}
          searchUiCaps={searchUiCaps}
          resumeSection={
            <div id="resume" className="scroll-mt-20">
              <BotResumeManager initialResumes={initialResumes} embedded minimal />
            </div>
          }
        />
      </div>
    </div>
  )
}
