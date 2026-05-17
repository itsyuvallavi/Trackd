import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!
  const poolMax =
    Number(process.env.PRISMA_POOL_MAX) ||
    (process.env.NODE_ENV === 'production' ? 1 : 5)

  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString,
      max: Math.max(1, poolMax),
      min: 0,
      idleTimeoutMillis: 10000, // Close idle connections quickly in serverless/session-pooler mode
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

export const prisma =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createPrismaClient())

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
