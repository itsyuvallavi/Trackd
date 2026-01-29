#!/usr/bin/env bun

/**
 * Test script for auto-archive functionality
 * 
 * Usage:
 *   bun run scripts/test-auto-archive.ts [userId]
 * 
 * If userId is not provided, will test for all users
 */

import { prisma } from '../src/lib/prisma'
import { archiveInactiveJobs, archiveInactiveJobsForAllUsers } from '../src/lib/auto-archive'

async function main() {
  const userId = process.argv[2]

  console.log('🧪 Testing Auto-Archive Functionality\n')

  if (userId) {
    console.log(`Testing for user: ${userId}\n`)
    await testForUser(userId)
  } else {
    console.log('Testing for all users\n')
    await testForAllUsers()
  }

  await prisma.$disconnect()
}

async function testForUser(userId: string) {
  // First, show current state
  const jobsBefore = await prisma.job.findMany({
    where: {
      userId,
      status: {
        in: ['APPLIED', 'INTERVIEW', 'SAVED'],
      },
    },
    include: {
      activities: {
        where: {
          type: 'EMAIL_UPDATE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  })

  console.log(`📊 Current state:`)
  console.log(`   Jobs in APPLIED/INTERVIEW/SAVED: ${jobsBefore.length}`)
  
  const jobsWithEmailActivity = jobsBefore.filter(j => j.activities.length > 0)
  console.log(`   Jobs with email activity: ${jobsWithEmailActivity.length}`)

  if (jobsWithEmailActivity.length > 0) {
    console.log('\n   Jobs with email activity:')
    for (const job of jobsWithEmailActivity) {
      const lastEmail = job.activities[0]
      const daysAgo = Math.floor(
        (Date.now() - lastEmail.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      console.log(`   - "${job.title}" at ${job.company}`)
      console.log(`     Status: ${job.status}`)
      console.log(`     Last email: ${daysAgo} days ago`)
      console.log(`     Last updated: ${Math.floor((Date.now() - job.updatedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago`)
    }
  }

  // Run archive function (dry run - we'll use a shorter period for testing)
  console.log('\n🔄 Running archive function (30 days threshold)...\n')
  
  const result = await archiveInactiveJobs(userId, 30, 7)

  console.log(`✅ Archive result:`)
  console.log(`   Jobs archived: ${result.jobsArchived}`)
  console.log(`   Errors: ${result.errors.length}`)

  if (result.jobsArchived > 0) {
    console.log('\n   Archived job IDs:')
    for (const jobId of result.jobIds) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          activities: {
            where: {
              type: 'STATUS_CHANGE',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      })
      if (job) {
        console.log(`   - ${job.title} at ${job.company}`)
        if (job.activities.length > 0) {
          console.log(`     Activity: ${job.activities[0].description}`)
        }
      }
    }
  }

  if (result.errors.length > 0) {
    console.log('\n   Errors:')
    for (const error of result.errors) {
      console.log(`   - ${error}`)
    }
  }
}

async function testForAllUsers() {
  console.log('🔄 Running archive for all users...\n')

  const result = await archiveInactiveJobsForAllUsers(30, 7)

  console.log(`✅ Archive result:`)
  console.log(`   Users processed: ${result.totalUsersProcessed}`)
  console.log(`   Total jobs archived: ${result.totalJobsArchived}`)

  if (result.totalJobsArchived > 0) {
    console.log('\n   Per-user breakdown:')
    for (const [userId, userResult] of Object.entries(result.resultsByUser)) {
      if (userResult.jobsArchived > 0) {
        console.log(`   - User ${userId}: ${userResult.jobsArchived} jobs archived`)
        if (userResult.errors.length > 0) {
          console.log(`     Errors: ${userResult.errors.length}`)
        }
      }
    }
  }

  const totalErrors = Object.values(result.resultsByUser).reduce(
    (sum, r) => sum + r.errors.length,
    0
  )
  if (totalErrors > 0) {
    console.log(`\n   Total errors: ${totalErrors}`)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
