/**
 * Resolve which optional `Job` columns exist without triggering Prisma P2022
 * (avoids noisy failed queries when local DB is behind migrations).
 * Cached for the lifetime of the Node process — restart dev server after `prisma migrate`.
 */

import { prisma } from '@/lib/prisma'

let cached: Set<string> | null = null
let loadPromise: Promise<Set<string>> | null = null

export async function getPublicJobTableColumnNames(): Promise<Set<string>> {
  if (cached) return cached
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const rows = await prisma.$queryRaw<{ attname: string }[]>`
        SELECT a.attname::text AS attname
        FROM pg_attribute a
        INNER JOIN pg_class c ON a.attrelid = c.oid AND c.relkind = 'r'
        INNER JOIN pg_namespace n ON c.relnamespace = n.oid AND n.nspname = 'public'
        WHERE a.attnum > 0
          AND NOT a.attisdropped
          AND c.relname IN ('Job', 'job')
      `
      const set = new Set(rows.map((r) => r.attname))
      cached = set
      return set
    } catch {
      /** Non-Postgres or introspection failed — assume fully migrated schema. */
      cached = new Set(['importSource', 'importJobBoard'])
      return cached
    }
  })()

  return loadPromise
}
