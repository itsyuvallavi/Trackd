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
      idleTimeoutMillis: 10000, // Close idle connections after 10s to free up pool
      connectionTimeoutMillis: 10000, // Wait up to 10s for a connection
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
