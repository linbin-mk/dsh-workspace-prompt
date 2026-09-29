/**
 * Composer arm chip: presence, the two states, and the inert reasons.
 *
 * The chip is rendered through `react-dom/server` with hand-fed props — the
 * same zero-machinery path the settings section's store tests use. What the
 * suite pins is the behavior a user sees: nothing at all for a workspace
 * without a prompt, a plain off chip and an ink-filled on chip, and a control
 * that names its reason instead of failing when it cannot be used.
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
  return { entries: [], status: 'ready', writable: true, switchSupported: true, ...overrides }
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

/** The state a workspace with a configured prompt reports for one switch value. */
const chipState = (enabled: boolean, overrides: Partial<WorkspacePromptsState> = {}): WorkspacePromptsState =>
  storeState({ entries: [{ cwd: '/ws', text: 'guidance', enabled }], ...overrides })

describe('WorkspacePromptChipEntry', () => {
  it('renders nothing for a workspace without a configured prompt', () => {
    expect(render(storeState(), '/ws')).toBe('')
  })

  it('renders nothing for a session without a workspace', () => {
    expect(render(chipState(false), undefined)).toBe('')
  })

  it('renders nothing while another workspace is the one configured', () => {
    expect(render(chipState(true), '/elsewhere')).toBe('')
  })

  it('shows the off chip as the plain control the siblings use, labelled with its state', () => {
    const markup = render(chipState(false), '/ws')
    expect(markup).toContain(zh['chip.label.off'])
    expect(markup).not.toContain(zh['chip.label.on'])
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('background:transparent')
    expect(markup).not.toContain('--dsw-specific-selector')
  })

  it('shows the on chip in the row gray, labelled with its state', () => {
    const markup = render(chipState(true), '/ws')
    expect(markup).toContain(zh['chip.label.on'])
    expect(markup).not.toContain(zh['chip.label.off'])
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('--dsw-specific-selector')
    expect(markup).not.toContain('background:transparent')
  })

  it('draws no inner chrome beyond the glyph and the label', () => {
    const markup = render(chipState(true), '/ws')
    // The two states used to carry a bordered glyph box and an ON/OFF tag.
    expect(markup).not.toContain('dashed')
    expect(markup).not.toContain('linear-gradient')
    expect(markup.match(/<span/g)?.length).toBe(1)
  })

  it('keeps the click available while the configuration is writable', () => {
    const markup = render(chipState(false), '/ws')
    expect(markup).not.toContain('aria-disabled="true"')
    expect(markup).not.toContain('disabled=""')
  })

  it('reports a read-only configuration instead of failing on click', () => {
    const markup = render(chipState(false, { writable: false }), '/ws')
    expect(markup).toContain('aria-disabled="true"')
    // A really disabled button swallows the tooltip that explains it.
    expect(markup).not.toContain('disabled=""')
  })

  it('reports a pre-upgrade Host half instead of failing on click', () => {
    const markup = render(chipState(false, { switchSupported: false }), '/ws')
    expect(markup).toContain('aria-disabled="true"')
    expect(markup).not.toContain('disabled=""')
  })

  it('stays inert until the Host answers with a section', () => {
    const markup = render(chipState(false, { status: 'loading' }), '/ws')
    expect(markup).toContain('aria-disabled="true"')
  })
})
