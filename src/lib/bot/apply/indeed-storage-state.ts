/**
 * Playwright storageState helpers: Indeed-only **filter** (for CDP export) and **full** persist after apply.
 */

import fs from 'fs'
import path from 'path'
import type { BrowserContext } from 'playwright-core'
import { logApply } from '@/lib/bot/apply/apply-log'

export function isIndeedCookieDomain(domain: string): boolean {
  const host = domain.replace(/^\./, '').toLowerCase()
  return host === 'indeed.com' || host.endsWith('.indeed.com')
}

function isIndeedOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase().endsWith('indeed.com')
  } catch {
    return false
  }
}

export type PlaywrightStorageState = Awaited<ReturnType<BrowserContext['storageState']>>

export function filterIndeedStorageState(state: PlaywrightStorageState): PlaywrightStorageState {
  return {
    cookies: state.cookies.filter((c) => isIndeedCookieDomain(c.domain)),
    origins: state.origins.filter((o) => isIndeedOrigin(o.origin)),
  }
}

function isValidStorageJsonFile(abs: string): boolean {
  try {
    if (!fs.existsSync(abs)) return false
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8')) as { cookies?: unknown }
    return Boolean(parsed && Array.isArray(parsed.cookies))
  } catch {
    return false
  }
}

function candidateProjectRoots(): string[] {
  const roots: string[] = []
  const push = (r: string | undefined) => {
    const t = r?.trim()
    if (t && !roots.includes(t)) roots.push(t)
  }
  push(process.cwd())
  push(process.env.INIT_CWD)
  push(process.env.TRACKD_PROJECT_ROOT)
  return roots
}

/**
 * Resolves BROWSER_APPLY_STORAGE_STATE to an existing JSON file (tries cwd, INIT_CWD, TRACKD_PROJECT_ROOT).
 */
export function findApplyStorageStateFilePath(): string | undefined {
  const raw = process.env.BROWSER_APPLY_STORAGE_STATE?.trim()
  if (!raw) return undefined
  if (path.isAbsolute(raw)) {
    return isValidStorageJsonFile(raw) ? raw : undefined
  }
  for (const root of candidateProjectRoots()) {
    const abs = path.join(root, raw)
    if (isValidStorageJsonFile(abs)) return abs
  }
  return undefined
}

/** Path to write after apply — same file we loaded, or cwd-relative default if env set but file missing yet. */
export function getApplyStorageStateWritePath(): string | undefined {
  const raw = process.env.BROWSER_APPLY_STORAGE_STATE?.trim()
  if (!raw) return undefined
  const found = findApplyStorageStateFilePath()
  if (found) return found
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw)
}

/**
 * After an apply run, rewrite storage JSON from the live browser context (full cookies + origins).
 * Not Indeed-filtered — Dice / other hosts need their cookies kept. CDP export script still supports
 * Indeed-only export when you want a small file from your desktop Chrome.
 *
 * Set BROWSER_APPLY_STORAGE_STATE_SAVE=0 to disable (e.g. read-only deploy disk).
 */
export async function persistIndeedStorageStateAfterApply(
  context: BrowserContext,
  targetPath: string
): Promise<void> {
  if (process.env.BROWSER_APPLY_STORAGE_STATE_SAVE?.trim() === '0') {
    logApply('browser_storage_state_save', { skipped: true, reason: 'BROWSER_APPLY_STORAGE_STATE_SAVE=0' })
    return
  }
  try {
    const raw = await context.storageState()
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, JSON.stringify(raw, null, 2), 'utf8')
    logApply('browser_storage_state_save', {
      ok: true,
      file: path.basename(targetPath),
      cookies: raw.cookies.length,
      origins: raw.origins.length,
    })
  } catch (e) {
    logApply('browser_storage_state_save', {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    })
  }
}
