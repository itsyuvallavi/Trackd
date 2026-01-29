import { prisma } from './prisma'

/**
 * Test database connection health
 * Useful for debugging connection issues
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  latency?: number
  error?: string
}> {
  const startTime = Date.now()
  
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`
    
    const latency = Date.now() - startTime
    
    return {
      healthy: true,
      latency,
    }
  } catch (error) {
    const latency = Date.now() - startTime
    
    return {
      healthy: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get database connection pool stats
 */
export async function getPoolStats() {
  // Note: pg Pool doesn't expose stats directly, but we can check connection count
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
    `
    
    return {
      activeConnections: Number(result[0]?.count || 0),
    }
  } catch (error) {
    return {
      activeConnections: -1,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
