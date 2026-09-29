/**
 * Composer arm chip: presence and the two designed states.
 *
 * The chip is rendered through `react-dom/server` with hand-fed props — the
 * same zero-machinery path the settings section's store tests use. What the
 * suite pins is the behavior a user sees: nothing at all for a workspace
 * without a prompt, an unarmed and an armed rendering that differ in more than
 * colour, and a disabled control while the configuration refuses writes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorkspacePromptChipEntry, type WorkspacePromptChipProps } from '../src/client/WorkspacePromptToggle.tsx'
import type { WorkspacePromptsState } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

/** Localized copy the chip renders, taken from the shipped dictionary. */
const t = (key: keyof typeof zh): string => zh[key]

/** One scripted store snapshot. */
function storeState(overrides: Partial<WorkspacePromptsState> = {}): WorkspacePromptsState {
  return { entries: [], status: 'ready', writable: true, ...overrides }
}

/** Props a session-scope slot entry receives for one scripted workspace. */
function props(
  state: WorkspacePromptsState,
  cwd: string | undefined,
  toggle: (cwd: string, enabled: boolean) => Promise<void> = async () => {},
): WorkspacePromptChipProps {
  return {
    sessionId: 's1',
    useSessions: (select: (snapshot: unknown) => unknown) => select({ byId: { s1: { cwd } } }),
    usePrompts: (select: (snapshot: WorkspacePromptsState) => unknown) => select(state),
    toggle,
    t,
  } as unknown as WorkspacePromptChipProps
}

const render = (state: WorkspacePromptsState, cwd: string | undefined): string =>
  renderToStaticMarkup(createElement(WorkspacePromptChipEntry, props(state, cwd)))

/** The state a workspace with a configured prompt reports before it is armed. */
const unarmed = (enabled: boolean): WorkspacePromptsState => storeState({
  entries: [{ cwd: '/ws', text: 'guidance', enabled }],
})

describe('WorkspacePromptChipEntry', () => {
  it('renders nothing for a workspace without a configured prompt', () => {
    expect(render(storeState(), '/ws')).toBe('')
  })

  it('renders nothing for a session without a workspace', () => {
    expect(render(unarmed(false), undefined)).toBe('')
  })

  it('renders nothing while another workspace is the one configured', () => {
    expect(render(unarmed(true), '/elsewhere')).toBe('')
  })

  it('shows the unarmed design as a dashed, tag-carrying control', () => {
    const markup = render(unarmed(false), '/ws')
    expect(markup).toContain(zh['chip.label'])
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain(zh['chip.state.off'])
    expect(markup).toContain('dashed')
    expect(markup).not.toContain('--dsw-alias-button-primary-fill')
    expect(markup).not.toContain(zh['chip.state.on'])
  })

  it('shows the armed design as a filled, tag-carrying control', () => {
    const markup = render(unarmed(true), '/ws')
    expect(markup).toContain(zh['chip.label'])
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain(zh['chip.state.on'])
    expect(markup).toContain('--dsw-alias-button-primary-fill')
    expect(markup).not.toContain(zh['chip.state.off'])
  })

  it('keeps the two states distinguishable without colour', () => {
    const off = render(unarmed(false), '/ws')
    const on = render(unarmed(true), '/ws')
    expect(off).not.toBe(on)
    // Both states name themselves: the tag differs, not just the fill.
    expect(off).toContain(zh['chip.state.off'])
    expect(on).toContain(zh['chip.state.on'])
  })

  it('disables the control while the Host document refuses writes', () => {
    const markup = render(storeState({
      entries: [{ cwd: '/ws', text: 'guidance', enabled: false }],
      writable: false,
    }), '/ws')
    expect(markup).toContain('disabled')
    expect(markup).toContain('aria-busy="false"')
  })

  it('disables the control until the Host answers with a section', () => {
    const markup = render(storeState({
      entries: [{ cwd: '/ws', text: 'guidance', enabled: false }],
      status: 'loading',
    }), '/ws')
    expect(markup).toContain('disabled')
  })
})
