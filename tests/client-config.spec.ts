import { describe, expect, it } from 'vitest'
import { promptFor, promptsView, setPrompt, unsetPrompt } from '../src/client/config.ts'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-settings/types'
import type { WorkspacePromptSettings } from '../src/prompt-settings.ts'

/** One scripted config-form snapshot; `value` is undefined until the Host answers. */
function snapshot(
  value: WorkspacePromptSettings | undefined,
  overrides: Partial<ConfigFormSnapshot<WorkspacePromptSettings>> = {},
): ConfigFormSnapshot<WorkspacePromptSettings> {
  return {
    status: value === undefined ? 'loading' : 'ready',
    value,
    base: undefined,
    user: undefined,
    revision: 3,
    writable: true,
    mode: 'host',
    ...overrides,
  }
}

/** A ConfigForm stand-in that answers the scripted snapshot and records every write. */
function formWith(
  state: ConfigFormSnapshot<WorkspacePromptSettings>,
  accepted = true,
): { form: ConfigForm<WorkspacePromptSettings>; writes: SettingsPathOpView[][] } {
  const writes: SettingsPathOpView[][] = []
  const form: ConfigForm<WorkspacePromptSettings> = {
    getSnapshot: () => state,
    subscribe: () => () => {},
    mutate: async (ops) => {
      writes.push(ops.map(op => structuredClone(op)))
      return accepted
    },
    set: async () => accepted,
    unset: async () => accepted,
  }
  return { form, writes }
}

describe('promptsView', () => {
  it('projects an accepted section into status, write permission, and prompts', () => {
    const { form } = formWith(snapshot({ prompts: { '/ws': 'guidance' } }))
    expect(promptsView(form.getSnapshot())).toEqual({
      status: 'ready',
      writable: true,
      prompts: { '/ws': 'guidance' },
    })
  })

  it('reports no prompts while the Host has not answered', () => {
    const { form } = formWith(snapshot(undefined))
    expect(promptsView(form.getSnapshot())).toEqual({ status: 'loading', writable: true, prompts: {} })
  })

  it('carries the refusal to write that disables the overview controls', () => {
    const { form } = formWith(snapshot({ prompts: {} }, { status: 'unavailable', writable: false, mode: 'memory' }))
    expect(promptsView(form.getSnapshot())).toEqual({ status: 'unavailable', writable: false, prompts: {} })
  })
})

describe('promptFor', () => {
  it('reads the stored prompt for one workspace directory', () => {
    const { form } = formWith(snapshot({ prompts: { '/ws': 'guidance' } }))
    expect(promptFor(form, '/ws')).toBe('guidance')
  })

  it('is empty for an unconfigured directory and before the first answer', () => {
    expect(promptFor(formWith(snapshot({ prompts: {} })).form, '/ws')).toBe('')
    expect(promptFor(formWith(snapshot(undefined)).form, '/ws')).toBe('')
  })
})

describe('setPrompt', () => {
  it('addresses the prompts map by workspace directory', async () => {
    const { form, writes } = formWith(snapshot({ prompts: {} }))
    await expect(setPrompt(form, '/ws', 'guidance')).resolves.toBe(true)
    expect(writes).toEqual([[{ op: 'set', path: ['prompts', '/ws'], value: 'guidance' }]])
  })

  it('reports a refused write instead of throwing', async () => {
    const { form } = formWith(snapshot({ prompts: {} }, { writable: false, mode: 'memory' }), false)
    await expect(setPrompt(form, '/ws', 'guidance')).resolves.toBe(false)
  })
})

describe('unsetPrompt', () => {
  it('removes exactly the addressed workspace directory', async () => {
    const { form, writes } = formWith(snapshot({ prompts: { '/ws': 'guidance' } }))
    await expect(unsetPrompt(form, '/ws')).resolves.toBe(true)
    expect(writes).toEqual([[{ op: 'unset', path: ['prompts', '/ws'] }]])
  })

  it('reports a refused clear instead of throwing', async () => {
    const { form } = formWith(snapshot({ prompts: { '/ws': 'guidance' } }), false)
    await expect(unsetPrompt(form, '/ws')).resolves.toBe(false)
  })
})
