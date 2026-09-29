/**
 * The workspace-prompt arm control.
 *
 * One chip, two states, told apart by the label's own suffix and one step of
 * fill: off is plain (no background, secondary label) and reads
 * `Workspace prompt-off`, on carries the row's chip gray and reads
 * `Workspace prompt-on`. Clicking flips it; nothing else is drawn inside.
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
import { IconEditOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
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
  /** Control name while the prompt is armed (carries the state). */
  labelOn: string
  /** Control name while the prompt is off (carries the state). */
  labelOff: string
  /** Hover text of the armed state. */
  onHint: string
  /** Hover text of the unarmed state. */
  offHint: string
  /** Hover text while the configuration refuses writes. */
  readonlyHint: string
  /** Hover text after a refused write. */
  failedHint: string
  /** Hover text while the Host half is older than this browser half. */
  skewHint: string
}

/** Local write phase of one chip. */
export type PromptTogglePhase = 'idle' | 'busy' | 'failed'

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  padding: '0 8px',
  borderRadius: 'var(--dsw-radius-sm, 8px)',
  border: 'none',
  font: 'inherit',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'background 160ms ease, color 160ms ease',
}

/** Off: the plain chip every sibling control uses — no fill, no outline. */
const idleChip: CSSProperties = {
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, rgb(97, 102, 107))',
}

/** Off under the pointer: the standard hover fill, nothing more. */
const idleChipLive: CSSProperties = {
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06))',
  color: 'var(--dsw-alias-label-primary, rgb(15, 17, 21))',
}

/** On: the row's own chip gray — the fill the composer's `+` control already uses. */
const armedChip: CSSProperties = {
  background: 'var(--dsw-specific-selector, rgb(242, 243, 245))',
  color: 'var(--dsw-alias-label-primary, rgb(15, 17, 21))',
}

/** On under the pointer: the same gray, one step deeper. */
const armedChipLive: CSSProperties = {
  background: 'var(--dsw-alias-interactive-bg-hover-solid, rgb(233, 235, 238))',
  color: 'var(--dsw-alias-label-primary, rgb(15, 17, 21))',
}

/** Refused write: the label turns to the error state for a moment. */
const failedChip: CSSProperties = {
  background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, rgb(236, 19, 19)) 10%, transparent)',
  color: 'var(--dsw-alias-state-error-primary, rgb(236, 19, 19))',
}

/** Why a chip refuses interaction while its persistent state stays visible. */
export type PromptToggleReason = 'none' | 'readonly' | 'skew'

/** The label the pointer currently reads. */
function hintFor(enabled: boolean, phase: PromptTogglePhase, reason: PromptToggleReason, labels: PromptToggleLabels): string {
  if (phase === 'failed') return labels.failedHint
  if (reason === 'skew') return labels.skewHint
  if (reason === 'readonly') return labels.readonlyHint
  return enabled ? labels.onHint : labels.offHint
}

/**
 * One arm control, rendered from plain props.
 * @param props - enabled state, write phase, inert reason, localized copy, and the click handler.
 * @returns the chip element for either state.
 */
export function PromptToggleChip({ enabled, reason, phase, labels, onToggle }: {
  /** Whether the workspace's prompt is currently armed. */
  enabled: boolean
  /** Why the switch refuses interaction; `none` keeps it clickable. */
  reason: PromptToggleReason
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
  // Only an in-flight write truly disables the button: a `disabled` button
  // swallows pointer events, and every other inert reason must stay hoverable
  // so its tooltip can explain itself.
  const inert = reason !== 'none' || phase === 'busy'

  return (
    <Tooltip label={hintFor(enabled, phase, reason, labels)} side="top" delayMs={400}>
      <button
        type="button"
        aria-label={enabled ? labels.labelOn : labels.labelOff}
        aria-pressed={enabled}
        aria-busy={phase === 'busy'}
        aria-disabled={inert}
        disabled={phase === 'busy'}
        style={{
          ...chipBase,
          ...state,
          ...(inert ? { cursor: 'not-allowed', opacity: 0.55 } : null),
        }}
        onClick={() => { if (!inert) onToggle(!enabled) }}
        onMouseEnter={() => { setLive(true) }}
        onMouseLeave={() => { setLive(false) }}
        onFocus={() => { setLive(true) }}
        onBlur={() => { setLive(false) }}
      >
        <IconEditOutlineRegular size={13} />
        <span>{enabled ? labels.labelOn : labels.labelOff}</span>
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

  // The Host half resolves the section with its own schema: an upgraded
  // browser half talking to a Host that has not been restarted yet finds no
  // arm field there, and every write to it would be refused. Say so instead of
  // letting the click fail.
  const reason: PromptToggleReason = !state.switchSupported
    ? 'skew'
    : state.status !== 'ready' || !state.writable ? 'readonly' : 'none'
  const labels: PromptToggleLabels = {
    labelOn: t('chip.label.on'),
    labelOff: t('chip.label.off'),
    onHint: t('chip.on.hint'),
    offHint: t('chip.off.hint'),
    readonlyHint: t('chip.readonly.hint'),
    failedHint: t('chip.failed.hint'),
    skewHint: t('chip.skew.hint'),
  }

  const switchTo = (next: boolean): void => {
    setPhase('busy')
    void toggle(entry.cwd, next)
      .then(() => { setPhase('idle') })
      .catch(() => { setPhase('failed') })
  }

  return <PromptToggleChip enabled={entry.enabled} reason={reason} phase={phase} labels={labels} onToggle={switchTo} />
}
