/**
 * Diagnostic script to check email sync configuration and status
 * Run with: bun run scripts/check-sync-status.ts
 */

import { prisma } from '../src/lib/prisma'

async function checkSyncStatus() {
  console.log('🔍 Checking email sync configuration...\n')

  try {
    // Get all email integrations
    const integrations = await prisma.emailIntegration.findMany({})

    if (integrations.length === 0) {
      console.log('❌ No email integrations found')
      return
    }

    console.log(`📧 Found ${integrations.length} email integration(s)\n`)

    for (const integration of integrations) {
      console.log('─'.repeat(60))
      console.log(`Email: ${integration.email}`)
      console.log(`User ID: ${integration.userId}`)
      console.log(`Active: ${integration.isActive ? '✅' : '❌'}`)
      console.log(`Auto-sync enabled: ${integration.autoSyncEnabled ? '✅' : '❌'}`)
      console.log(`Auto-sync frequency: ${integration.autoSyncFrequency} minutes`)
      console.log(`Last synced: ${integration.lastSyncedAt ? integration.lastSyncedAt.toISOString() : 'Never'}`)
      console.log(`Next sync at: ${integration.nextSyncAt ? integration.nextSyncAt.toISOString() : 'Not scheduled'}`)
      
      if (integration.nextSyncAt) {
        const now = new Date()
        const nextSync = new Date(integration.nextSyncAt)
        const diffMinutes = Math.round((nextSync.getTime() - now.getTime()) / (1000 * 60))
        if (diffMinutes < 0) {
          console.log(`⚠️  Next sync is ${Math.abs(diffMinutes)} minutes overdue!`)
        } else {
          console.log(`⏰ Next sync in ${diffMinutes} minutes`)
        }
      }

      if (integration.lastError) {
        console.log(`❌ Last error: ${integration.lastError}`)
      }

      // Check recent sync logs
      const recentLogs = await prisma.emailSyncLog.findMany({
        where: { userId: integration.userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      console.log(`\nRecent sync logs (last 5):`)
      if (recentLogs.length === 0) {
        console.log('  No sync logs found')
      } else {
        for (const log of recentLogs) {
          const status = log.success ? '✅' : '❌'
          const duration = log.duration ? `${Math.round(log.duration / 1000)}s` : 'N/A'
          console.log(`  ${status} ${log.source} - ${log.createdAt.toISOString()} (${duration})`)
          console.log(`    Emails: ${log.totalEmails}, Processed: ${log.processedEmails}, Updated: ${log.jobsUpdated}`)
          if (!log.success && log.errorMessage) {
            console.log(`    Error: ${log.errorMessage}`)
          }
        }
      }
      console.log('')
    }

    // Check for integrations that should be syncing
    const activeIntegrations = integrations.filter(
      (i) => i.isActive && i.autoSyncEnabled
    )

    console.log('─'.repeat(60))
    console.log(`\n📊 Summary:`)
    console.log(`Total integrations: ${integrations.length}`)
    console.log(`Active with auto-sync enabled: ${activeIntegrations.length}`)

    if (activeIntegrations.length === 0) {
      console.log('\n⚠️  No integrations are configured for auto-sync!')
      console.log('   Users need to enable auto-sync in settings.')
    } else {
      const overdue = activeIntegrations.filter((i) => {
        if (!i.nextSyncAt) return true
        return new Date(i.nextSyncAt) < new Date()
      })
      
      console.log(`Overdue for sync: ${overdue.length}`)
      if (overdue.length > 0) {
        console.log('\n⚠️  Some integrations are overdue for sync!')
        console.log('   The cron job should run hourly and sync these.')
      }
    }

    // Check GitHub Actions setup
    console.log('\n─'.repeat(60))
    console.log('\n🔧 Cron Setup Check:')
    console.log('1. GitHub Actions workflow: .github/workflows/sync-emails.yml')
    console.log('   - Scheduled: Every hour (0 * * * *)')
    console.log('   - Required secrets: APP_URL, CRON_SECRET')
    console.log('\n2. Verify secrets are set in GitHub repository settings')
    console.log('   Settings → Secrets and variables → Actions')
    console.log('\n3. Check workflow runs:')
    console.log('   GitHub → Actions tab → "Sync Emails Hourly" workflow')
  } catch (error) {
    console.error('❌ Error checking sync status:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkSyncStatus()
