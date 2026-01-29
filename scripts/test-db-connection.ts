#!/usr/bin/env bun

/**
 * Test database connection and diagnose issues
 * 
 * Usage:
 *   bun run scripts/test-db-connection.ts
 */

import { prisma } from '../src/lib/prisma'
import { checkDatabaseHealth, getPoolStats } from '../src/lib/db-health-check'

async function main() {
  console.log('🔍 Testing Database Connection\n')

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!')
    process.exit(1)
  }

  // Mask sensitive parts of connection string
  const maskedUrl = process.env.DATABASE_URL.replace(
    /:\/\/[^:]+:[^@]+@/,
    '://***:***@'
  )
  console.log(`📡 Connection String: ${maskedUrl}\n`)

  // Test basic connection
  console.log('1️⃣ Testing basic connection...')
  const health = await checkDatabaseHealth()
  
  if (health.healthy) {
    console.log(`✅ Connection healthy (latency: ${health.latency}ms)\n`)
  } else {
    console.log(`❌ Connection failed: ${health.error}`)
    console.log(`   Latency: ${health.latency}ms\n`)
    process.exit(1)
  }

  // Test pool stats
  console.log('2️⃣ Checking connection pool...')
  const poolStats = await getPoolStats()
  console.log(`   Active connections: ${poolStats.activeConnections}`)
  if (poolStats.error) {
    console.log(`   ⚠️  Error getting stats: ${poolStats.error}`)
  }
  console.log()

  // Test a simple query
  console.log('3️⃣ Testing simple query...')
  try {
    const startTime = Date.now()
    const result = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version()
    `
    const latency = Date.now() - startTime
    console.log(`✅ Query successful (latency: ${latency}ms)`)
    console.log(`   PostgreSQL version: ${result[0]?.version?.substring(0, 50)}...\n`)
  } catch (error) {
    console.log(`❌ Query failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
  }

  // Test Prisma query
  console.log('4️⃣ Testing Prisma query...')
  try {
    const startTime = Date.now()
    const count = await prisma.job.count()
    const latency = Date.now() - startTime
    console.log(`✅ Prisma query successful (latency: ${latency}ms)`)
    console.log(`   Total jobs in database: ${count}\n`)
  } catch (error) {
    console.log(`❌ Prisma query failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
  }

  // Test connection pool limits
  console.log('5️⃣ Testing concurrent connections...')
  try {
    const promises = Array.from({ length: 5 }, () =>
      prisma.$queryRaw`SELECT 1`
    )
    const startTime = Date.now()
    await Promise.all(promises)
    const latency = Date.now() - startTime
    console.log(`✅ Concurrent queries successful (latency: ${latency}ms)\n`)
  } catch (error) {
    console.log(`❌ Concurrent queries failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
  }

  console.log('✅ All tests completed!')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
