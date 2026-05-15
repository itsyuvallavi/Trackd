import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

type ChromeManifest = {
  manifest_version: number
  permissions?: string[]
  host_permissions?: string[]
  action?: {
    default_popup?: string
    default_icon?: Record<string, string>
  }
  icons?: Record<string, string>
  content_scripts?: Array<{
    matches?: string[]
    js?: string[]
  }>
}

function readManifest(): ChromeManifest {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), 'browser-extension/manifest.json'), 'utf8'),
  )
}

describe('browser extension manifest', () => {
  it('references files that exist in the extension package', () => {
    const manifest = readManifest()
    const root = path.join(process.cwd(), 'browser-extension')
    const referencedFiles = [
      manifest.action?.default_popup,
      ...Object.values(manifest.action?.default_icon ?? {}),
      ...Object.values(manifest.icons ?? {}),
      ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
    ].filter((file): file is string => Boolean(file))

    expect(referencedFiles.length).toBeGreaterThan(0)
    for (const file of referencedFiles) {
      expect(existsSync(path.join(root, file)), file).toBe(true)
    }
  })

  it('declares required permissions and Trackd API host permissions', () => {
    const manifest = readManifest()

    expect(manifest.manifest_version).toBe(3)
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['activeTab', 'storage', 'scripting']),
    )
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        'https://trackd-eight.vercel.app/*',
        'https://trackd.app/*',
        'http://localhost:3001/*',
      ]),
    )
  })

  it('loads the shared content script before site-specific extractors', () => {
    const manifest = readManifest()
    const scripts = manifest.content_scripts?.[0]?.js ?? []

    expect(scripts[0]).toBe('scripts/content.js')
    expect(scripts).toEqual(
      expect.arrayContaining([
        'scripts/extractors/linkedin-extractor.js',
        'scripts/extractors/ziprecruiter-extractor.js',
        'scripts/extractors/landing-jobs-extractor.js',
      ]),
    )
  })
})
