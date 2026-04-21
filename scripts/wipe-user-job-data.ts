#!/usr/bin/env bun
/**
 * Delete ALL jobs (every source) and related data for one user — empty board / queue.
 * Keeps account + settings: Profile, ApplicationProfile, EmailIntegration, ExtensionKey,
 * BotConfig, BotResume (and Supabase auth — unchanged).
 *
 * Usage:
 *   bun run scripts/wipe-user-job-data.ts <userId> --confirm
 *
 * Optional (all ON by default — pass to skip that delete):
 *   --keep-notifications
 *   --keep-email-sync-logs
 *   --keep-bot-runs
 *   --keep-interview-prep   (InterviewSession + messages)
 *
 * <userId> = Supabase auth user id (= Profile.id).
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.includes('--confirm')) {
    console.error(
      'Refusing to run without --confirm.\nUsage: bun run scripts/wipe-user-job-data.ts <userId> --confirm'
    )
    process.exit(1)
  }

  const userId = argv.find((a) => !a.startsWith('--'))
  if (!userId) {
    console.error('Missing <userId> (your Supabase auth / Profile id).')
    process.exit(1)
  }

  const keepNotifications = argv.includes('--keep-notifications')
  const keepEmailSyncLogs = argv.includes('--keep-email-sync-logs')
  const keepBotRuns = argv.includes('--keep-bot-runs')
  const keepInterviewPrep = argv.includes('--keep-interview-prep')

  const profile = await prisma.profile.findUnique({ where: { id: userId } })
  if (!profile) {
    console.error(`No Profile row for id ${userId}. Wrong id?`)
    process.exit(1)
  }

  console.log(`\nWiping job data for: ${profile.email} (${userId})\n`)

  const jobCount = await prisma.job.count({ where: { userId } })
  console.log(`Jobs to remove: ${jobCount}`)

  const result = await prisma.$transaction(async (tx) => {
    const attempts = await tx.applicationAttempt.deleteMany({ where: { userId } })

    let sessions = { count: 0 }
    if (!keepInterviewPrep) {
      const sessionIds = await tx.interviewSession.findMany({
        where: { userId },
        select: { id: true },
      })
      const ids = sessionIds.map((s) => s.id)
      if (ids.length > 0) {
        await tx.interviewMessage.deleteMany({ where: { sessionId: { in: ids } } })
      }
      sessions = await tx.interviewSession.deleteMany({ where: { userId } })
    }

    let notifications = { count: 0 }
    if (!keepNotifications) {
      notifications = await tx.notification.deleteMany({ where: { userId } })
    }

    let syncLogs = { count: 0 }
    if (!keepEmailSyncLogs) {
      syncLogs = await tx.emailSyncLog.deleteMany({ where: { userId } })
    }

    let runs = { count: 0 }
    if (!keepBotRuns) {
      runs = await tx.botRun.deleteMany({ where: { userId } })
    }

    const dismissed = await tx.dismissedJobImport.deleteMany({ where: { userId } })
    const jobs = await tx.job.deleteMany({ where: { userId } })

    return { attempts, sessions, notifications, syncLogs, runs, dismissed, jobs }
  })

  console.log('\nDeleted:')
  console.log(`  ApplicationAttempt: ${result.attempts.count}`)
  if (!keepInterviewPrep) console.log(`  InterviewSession:   ${result.sessions.count}`)
  if (!keepNotifications) console.log(`  Notification:       ${result.notifications.count}`)
  if (!keepEmailSyncLogs) console.log(`  EmailSyncLog:       ${result.syncLogs.count}`)
  if (!keepBotRuns) console.log(`  BotRun:             ${result.runs.count}`)
  console.log(`  DismissedJobImport: ${result.dismissed.count} (so bot can re-import after full wipe)`)
  console.log(`  Job (+ Activities): ${result.jobs.count} (activities cascade with jobs)`)
  console.log(
    '\nUnchanged: Profile, ApplicationProfile, EmailIntegration, ExtensionKey, BotConfig, BotResume, Feedback.'
  )
  console.log('Supabase Storage files (e.g. screenshots) are not removed — delete manually if needed.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
