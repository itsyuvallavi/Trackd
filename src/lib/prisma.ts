import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!

  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString,
      max: 10, // Increased from 5 to handle more concurrent requests and improve TTFB
      min: 2, // Keep two connections warm for faster response times
      idleTimeoutMillis: 30000, // Close idle connections after 30s to free up pool
      connectionTimeoutMillis: 20000, // Wait up to 20s for a connection (increased from 10s)
      // Better error handling
      allowExitOnIdle: false, // Don't exit process when pool is idle
    })

    // Handle pool errors gracefully
    globalForPrisma.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err)
    })

    globalForPrisma.pool.on('connect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Database connection established')
      }
    })
  }

  const adapter = new PrismaPg(globalForPrisma.pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown: close connections on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })

  process.on('SIGINT', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}
