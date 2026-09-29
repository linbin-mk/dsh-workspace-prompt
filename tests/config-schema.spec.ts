import { describe, expect, it } from 'vitest'
import z from '@deepseek-ai/schemastery'
import { Config } from '../src/index.ts'
import { ENABLED_FIELD, PROMPTS_FIELD } from '../src/prompt-settings.ts'

/**
 * The Config schema is evaluated twice per deployment: the Host resolves it to
 * build the live `prompts` field, and the browser half rehydrates its serialized
 * envelope to validate each section the shared config form holds. The web
 * client's snapshot store deep-freezes every section it publishes, so the
 * browser-side call must survive a read-only map — a schema that writes into its
 * input turns the settings page stale without failing anything visibly.
 */
const rehydrate = (): z => new z(JSON.parse(JSON.stringify(Config.toJSON())))

describe('Config schema', () => {
  it('resolves a configured prompts map for the Host', () => {
    expect(Config({ prompts: { '/ws': 'hello' } }).prompts.get()).toEqual({ '/ws': 'hello' })
  })

  it('defaults the prompts map to empty', () => {
    expect(Config({}).prompts.get()).toEqual({})
  })

  it('resolves the per-workspace arm switches for the Host', () => {
    expect(Config({ prompts: { '/ws': 'hello' }, enabled: { '/ws': true } }).enabled.get()).toEqual({ '/ws': true })
  })

  it('defaults the arm switches to empty, so a saved prompt stays inert', () => {
    expect(Config({ prompts: { '/ws': 'hello' } }).enabled.get()).toEqual({})
  })

  it('reads a deeply read-only section, the shape the web client publishes', () => {
    const section = Object.freeze({
      prompts: Object.freeze({ '/ws': 'hello' }),
      enabled: Object.freeze({ '/ws': true }),
    })
    const node = rehydrate()
    expect(() => node(section)).not.toThrow()
    expect(node(section).prompts.get()).toEqual({ '/ws': 'hello' })
    expect(node(section).enabled.get()).toEqual({ '/ws': true })
  })

  it('keeps both written fields volatile, so the settings form may write them', () => {
    const schema = rehydrate()
    const fields = schema.dict as Record<string, z>
    expect(fields[PROMPTS_FIELD]?.meta.volatile).toBe(true)
    expect(fields[ENABLED_FIELD]?.meta.volatile).toBe(true)
  })
})
