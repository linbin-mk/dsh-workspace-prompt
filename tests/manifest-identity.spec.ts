import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Guard against a half-done rename (see the open-sourcing checklist): a package
 * name is not declared once but repeated as an *identifier* in the loader
 * manifest and in the client bundle's banner. Asserting the derived values
 * against `package.json` goes red on the next rename, while asserting against a
 * literal would encode the stale name and stay green through the bug.
 */
const root = fileURLToPath(new URL('..', import.meta.url))
const read = (relative: string): string => readFileSync(new URL(relative, `file://${root}`), 'utf8')

const manifest = JSON.parse(read('package.json')) as { name: string }
const patch = read('cordis.patch.yml')
const build = read('tsdown.config.ts')

describe('published identity', () => {
  it('names the loader row after the package, so the profile can resolve it', () => {
    const row = /name:\s*'([^']+)'/.exec(patch)?.[1]
    expect(row).toBe(manifest.name)
  })

  it('registers the client bundle under the package name, so the boot graph finds it', () => {
    const id = /__ModuleLoader__\.load\(\{ id: "([^"]+)"/.exec(build)?.[1]
    expect(id).toBe(manifest.name)
  })

  it('keeps the settings namespace stable across renames, so stored prompts survive', () => {
    expect(read('src/identity.ts')).toContain("export const name = 'workspace-prompt'")
    expect(read('src/index.ts')).toContain('workspace-prompt')
  })
})
