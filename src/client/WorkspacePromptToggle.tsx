/**
 * The workspace-prompt arm control.
 *
 * One control, two states, deliberately not a switch: unarmed is a ghost chip
 * (dashed outline, muted glyph, dashed `OFF` tag), armed is a lit chip (brand
 * fill, white glyph, solid `ON` tag, focus glow). Colour is never the only
 * carrier — the tag changes word and the outline changes style — so the state
 * survives greyscale and reads without hovering.
 *
 * {@link WorkspacePromptChipEntry} is the composer occupant: it registers into
 * `conversation.input.left`, resolves the current Session's workspace, and
 * renders nothing at all while that workspace has no configured prompt — the
 * control exists only where it can do something. {@link PromptToggleChip} is
 * the same visual reused by the settings overview rows, which pass their own
 * localized copy.
 */

import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { IconEditOutlineRegular, IconSparkleRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the sessions-list snapshot the `useSessions` standard seat selects
// over. The selector parameters below carry explicit annotations, the same way
// the settings section annotates its own hook call.
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: the `conversation.input.left` SlotMap key this entry contributes to.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the `sessionId` and `useSessions` standard props of a session-scope slot.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { WorkspacePromptsState } from './stores'

/** Registrant-side business face of the composer chip. */
export interface WorkspacePromptChipInjected {
  hooks: { prompts: HostObservable<WorkspacePromptsState> }
  /** Arm or disarm one workspace's prompt. */
  toggle: (cwd: string, enabled: boolean) => Promise<void>
}

/** Component props composed by the slot machinery for the composer occupant. */
export type WorkspacePromptChipProps =
  PropsRuntime<'conversation.input.left'>
  & PropsLocale<'workspace-prompt'>
  & InjectFace<WorkspacePromptChipInjected>

/** Already-localized copy one chip renders. */
export interface PromptToggleLabels {
  /** Control name shown on both states. */
  label: string
  /** Tag of the armed state. */
  on: string
  /** Tag of the unarmed state. */
  off: string
  /** Hover text of the armed state. */
  onHint: string
  /** Hover text of the unarmed state. */
  offHint: string
  /** Hover text while the configuration refuses writes. */
  readonlyHint: string
  /** Hover text after a refused write. */
  failedHint: string
}

/** Local write phase of one chip. */
export type PromptTogglePhase = 'idle' | 'busy' | 'failed'

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  padding: '0 6px 0 8px',
  borderRadius: 'var(--dsw-radius-sm, 8px)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'background 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease',
}

/** Unarmed: a ghost chip — dashed outline, muted label, nothing filled. */
const idleChip: CSSProperties = {
  background: 'transparent',
  border: '1px dashed var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12))',
  color: 'var(--dsw-alias-label-secondary, rgb(97, 102, 107))',
}

/** Unarmed under the pointer: the outline closes and the label firms up. */
const idleChipLive: CSSProperties = {
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06))',
  border: '1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1))',
  color: 'var(--dsw-alias-label-primary, rgb(15, 17, 21))',
}

/**
 * Armed: a solid chip in the theme's own filled-control ink (the same fill the
 * primary button uses), inverted label, and a halo that states the control is
 * on without changing its size.
 */
const armedChip: CSSProperties = {
  background: 'var(--dsw-alias-button-primary-fill, rgb(15, 17, 21))',
  border: '1px solid transparent',
  color: 'var(--dsw-alias-label-primary-foreground, rgb(255, 255, 255))',
  boxShadow: '0 0 0 3px color-mix(in srgb, var(--dsw-alias-button-primary-fill, rgb(15, 17, 21)) 14%, transparent)',
}

/** Armed under the pointer: the halo deepens and the chip lifts. */
const armedChipLive: CSSProperties = {
  ...armedChip,
  background: 'var(--dsw-alias-button-primary-hover, rgb(15, 17, 21))',
  boxShadow: '0 0 0 3px color-mix(in srgb, var(--dsw-alias-button-primary-fill, rgb(15, 17, 21)) 24%, transparent), '
    + '0 2px 6px color-mix(in srgb, var(--dsw-alias-button-primary-fill, rgb(15, 17, 21)) 28%, transparent)',
}

/** Refused write: the two-state design is kept, the outline turns to the error state. */
const failedChip: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--dsw-alias-state-error-primary, rgb(236, 19, 19))',
  color: 'var(--dsw-alias-state-error-primary, rgb(236, 19, 19))',
}

const glyphBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: 6,
}

const idleGlyph: CSSProperties = { ...glyphBase, border: '1px dashed currentColor', opacity: 0.85 }

const armedGlyph: CSSProperties = {
  ...glyphBase,
  border: '1px solid currentColor',
  background: 'color-mix(in srgb, currentColor 18%, transparent)',
}

const tagBase: CSSProperties = {
  padding: '1px 4px',
  borderRadius: 4,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.4,
  lineHeight: '11px',
}

const idleTag: CSSProperties = { ...tagBase, border: '1px dashed currentColor', opacity: 0.8 }

/** Armed tag: the inverted micro-pill, the one part the ghost state has no equivalent of. */
const armedTag: CSSProperties = {
  ...tagBase,
  background: 'var(--dsw-alias-label-primary-foreground, rgb(255, 255, 255))',
  color: 'var(--dsw-alias-button-primary-fill, rgb(15, 17, 21))',
}

/** The label the pointer currently reads. */
function hintFor(enabled: boolean, phase: PromptTogglePhase, disabled: boolean, labels: PromptToggleLabels): string {
  if (disabled && phase !== 'failed') return labels.readonlyHint
  if (phase === 'failed') return labels.failedHint
  return enabled ? labels.onHint : labels.offHint
}

/**
 * One arm control, rendered from plain props.
 * @param props - enabled state, write phase, localized copy, and the click handler.
 * @returns the chip element for either state.
 */
export function PromptToggleChip({ enabled, disabled, phase, labels, onToggle }: {
  /** Whether the workspace's prompt is currently armed. */
  enabled: boolean
  /** Whether the configuration refuses writes right now. */
  disabled: boolean
  /** Local write phase of this control. */
  phase: PromptTogglePhase
  /** Localized copy for both states. */
  labels: PromptToggleLabels
  /** Ask for the opposite state. */
  onToggle: (next: boolean) => void
}): JSX.Element {
  const [live, setLive] = useState(false)
  const failed = phase === 'failed'
  const state = failed ? failedChip : enabled ? (live ? armedChipLive : armedChip) : (live ? idleChipLive : idleChip)
  const inert = disabled || phase === 'busy'

  return (
    <Tooltip label={hintFor(enabled, phase, disabled, labels)} side="top" delayMs={400}>
      <button
        type="button"
        aria-label={labels.label}
        aria-pressed={enabled}
        aria-busy={phase === 'busy'}
        disabled={inert}
        style={{
          ...chipBase,
          ...state,
          ...(inert ? { cursor: 'not-allowed', opacity: 0.55 } : null),
        }}
        onClick={() => { onToggle(!enabled) }}
        onMouseEnter={() => { setLive(true) }}
        onMouseLeave={() => { setLive(false) }}
        onFocus={() => { setLive(true) }}
        onBlur={() => { setLive(false) }}
      >
        <span aria-hidden style={enabled && !failed ? armedGlyph : idleGlyph}>
          {enabled && !failed ? <IconSparkleRegular size={11} /> : <IconEditOutlineRegular size={11} />}
        </span>
        <span>{labels.label}</span>
        <span aria-hidden style={enabled && !failed ? armedTag : idleTag}>
          {enabled && !failed ? labels.on : labels.off}
        </span>
      </button>
    </Tooltip>
  )
}

/**
 * Composer occupant of `conversation.input.left`, directly right of the
 * permission and plan controls in the composer tool row.
 *
 * It renders only while the current Session's workspace has a configured
 * prompt: an unconfigured workspace gets the row exactly as it was before the
 * plugin was installed. The switch state is the workspace's, not the
 * Session's, so arming it here also arms the next Session in the same
 * workspace.
 * @param props - composed slot props (Session identity plus the injected face).
 * @returns the chip, or null when this workspace has no prompt to arm.
 */
export function WorkspacePromptChipEntry({
  sessionId, useSessions, usePrompts, toggle, t,
}: WorkspacePromptChipProps): JSX.Element | null {
  const cwd = useSessions((state: SessionListState) => state.byId[sessionId]?.cwd)
  const state: WorkspacePromptsState = usePrompts((value: WorkspacePromptsState) => value)
  const [phase, setPhase] = useState<PromptTogglePhase>('idle')
  const entry = cwd === undefined ? undefined : state.entries.find(item => item.cwd === cwd)

  // A refused write reports itself on the chip for a moment, then clears: the
  // store keeps the Host's value, so nothing else here has to roll back.
  useEffect(() => {
    if (phase !== 'failed') return
    const timer = setTimeout(() => { setPhase('idle') }, 2200)
    return () => { clearTimeout(timer) }
  }, [phase])

  if (entry === undefined) return null

  const disabled = state.status !== 'ready' || !state.writable
  const labels: PromptToggleLabels = {
    label: t('chip.label'),
    on: t('chip.state.on'),
    off: t('chip.state.off'),
    onHint: t('chip.on.hint'),
    offHint: t('chip.off.hint'),
    readonlyHint: t('chip.readonly.hint'),
    failedHint: t('chip.failed.hint'),
  }

  const switchTo = (next: boolean): void => {
    setPhase('busy')
    void toggle(entry.cwd, next)
      .then(() => { setPhase('idle') })
      .catch(() => { setPhase('failed') })
  }

  return <PromptToggleChip enabled={entry.enabled} disabled={disabled} phase={phase} labels={labels} onToggle={switchTo} />
}
