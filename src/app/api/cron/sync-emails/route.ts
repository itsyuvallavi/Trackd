import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncEmailsForUser } from './sync-helper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify this is called by Vercel Cron (in production)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('🔄 Starting scheduled email sync...')

    // Get all active email integrations with auto-sync enabled
    const integrations = await prisma.emailIntegration.findMany({
      where: { 
        isActive: true,
        autoSyncEnabled: true,
      },
    })

    if (integrations.length === 0) {
      return NextResponse.json({ message: 'No active integrations with auto-sync enabled' })
    }

    let totalProcessed = 0
    let totalUpdated = 0
    let totalNewJobsDetected = 0
    let totalAmbiguous = 0

    for (const integration of integrations) {
      try {
        // Check if it's time to sync (based on autoSyncFrequency)
        if (integration.nextSyncAt && new Date() < integration.nextSyncAt) {
          console.log(`Skipping user ${integration.userId}: next sync at ${integration.nextSyncAt}`)
          continue
        }

        console.log(`Syncing emails for user: ${integration.userId}`)

        // Call the sync function (we'll create a helper that doesn't require auth)
        const result = await syncEmailsForUser(integration.userId)

        if (result.success && result.stats) {
          totalProcessed += result.stats.processedEmails
          totalUpdated += result.stats.updatedJobs
          totalNewJobsDetected += result.stats.newJobsDetected
          totalAmbiguous += result.stats.ambiguousMatches

          // Update nextSyncAt based on frequency
          const nextSync = new Date()
          nextSync.setMinutes(nextSync.getMinutes() + (integration.autoSyncFrequency || 60))
          
          await prisma.emailIntegration.update({
            where: { id: integration.id },
            data: {
              nextSyncAt: nextSync,
              lastError: null,
            },
          })

          console.log(`✓ Sync complete for ${integration.userId}: ${result.stats.processedEmails} processed`)
        } else {
          throw new Error(result.error || 'Sync failed')
        }
      } catch (error) {
        console.error(`Error syncing for user ${integration.userId}:`, error)

        // Log error to database and create notification
        await prisma.emailIntegration.update({
          where: { id: integration.id },
          data: {
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
        })

        // Create error notification
        const { NotificationService } = await import('@/lib/notification-service')
        const notificationService = new NotificationService()
        await notificationService.createSyncErrorNotification(
          integration.userId,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    return NextResponse.json({
      success: true,
      integrationsProcessed: integrations.length,
      totalProcessed,
      totalUpdated,
      totalNewJobsDetected,
      totalAmbiguous,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
