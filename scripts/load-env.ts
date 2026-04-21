/**
 * Load `.env` then `.env.local` (override) before Prisma reads DATABASE_URL / BOT_SEARCH_SOURCES.
 * Import this file first from CLI scripts (`import './load-env'`).
 */

import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local'), override: true })

/** CLI wins over files: `--sources=jsearch,jobs_search_api` */
const sourcesArg = process.argv.find((a) => a.startsWith('--sources='))
if (sourcesArg) {
  process.env.BOT_SEARCH_SOURCES = sourcesArg.replace(/^--sources=/, '').trim()
}
