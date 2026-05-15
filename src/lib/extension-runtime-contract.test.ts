import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

type ChromeManifest = {
  manifest_version: number
  permissions?: string[]
  host_permissions?: string[]
  action?: {
    default_popup?: string
  }
  background?: unknown
  content_scripts?: Array<{
    matches?: string[]
    js?: string[]
    run_at?: string
  }>
}

const extensionRoot = path.join(process.cwd(), 'browser-extension')

function readExtensionFile(relativePath: string): string {
  return readFileSync(path.join(extensionRoot, relativePath), 'utf8')
}

function readManifest(): ChromeManifest {
  return JSON.parse(readExtensionFile('manifest.json'))
}

function extractStringArray(source: string, constName: string): string[] {
  const match = source.match(new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`))
  expect(match, `Expected ${constName} array to exist`).toBeTruthy()

  return Array.from(match?.[1].matchAll(/'([^']+)'/g) ?? []).map((item) => item[1])
}

describe('browser extension runtime contract', () => {
  it('packages the popup script and has no background service worker contract', () => {
    const manifest = readManifest()
    const popupPath = manifest.action?.default_popup

    expect(manifest.manifest_version).toBe(3)
    expect(popupPath).toBe('popup.html')
    expect(existsSync(path.join(extensionRoot, popupPath ?? ''))).toBe(true)
    expect(readExtensionFile('popup.html')).toContain('<script src="scripts/popup.js"></script>')

    // The current extension architecture is popup-driven: no background worker is packaged.
    expect(manifest.background).toBeUndefined()
  })

  it('keeps manifest content scripts in sync with popup dynamic injection', () => {
    const manifest = readManifest()
    const manifestScripts = manifest.content_scripts?.[0]?.js ?? []
    const popupScripts = extractStringArray(readExtensionFile('scripts/popup.js'), 'CONTENT_SCRIPT_FILES')

    expect(manifestScripts).toEqual(popupScripts)
    expect(manifestScripts[0]).toBe('scripts/content.js')

    for (const script of manifestScripts) {
      expect(existsSync(path.join(extensionRoot, script)), script).toBe(true)
    }
  })

  it('declares host permissions for API calls and matched job-board content scripts', () => {
    const manifest = readManifest()
    const hostPermissions = manifest.host_permissions ?? []
    const contentMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? []

    expect(hostPermissions).toEqual(
      expect.arrayContaining([
        'https://trackd-eight.vercel.app/*',
        'https://trackd.app/*',
        'http://localhost:3000/*',
        'http://localhost:3001/*',
      ]),
    )

    for (const matchPattern of contentMatches) {
      expect(hostPermissions, matchPattern).toContain(matchPattern)
    }
  })

  it('runs content scripts at document idle so SPA pages can settle before extraction', () => {
    const manifest = readManifest()

    expect(manifest.content_scripts).toHaveLength(1)
    expect(manifest.content_scripts?.[0]?.run_at).toBe('document_idle')
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['activeTab', 'storage', 'scripting']),
    )
  })
})
