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
import type { JSX } from 'react';
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkspacePromptsState } from './stores';
/** Registrant-side business face of the composer chip. */
export interface WorkspacePromptChipInjected {
    hooks: {
        prompts: HostObservable<WorkspacePromptsState>;
    };
    /** Arm or disarm one workspace's prompt. */
    toggle: (cwd: string, enabled: boolean) => Promise<void>;
}
/** Component props composed by the slot machinery for the composer occupant. */
export type WorkspacePromptChipProps = PropsRuntime<'conversation.input.left'> & PropsLocale<'workspace-prompt'> & InjectFace<WorkspacePromptChipInjected>;
/** Already-localized copy one chip renders. */
export interface PromptToggleLabels {
    /** Control name shown on both states. */
    label: string;
    /** Tag of the armed state. */
    on: string;
    /** Tag of the unarmed state. */
    off: string;
    /** Hover text of the armed state. */
    onHint: string;
    /** Hover text of the unarmed state. */
    offHint: string;
    /** Hover text while the configuration refuses writes. */
    readonlyHint: string;
    /** Hover text after a refused write. */
    failedHint: string;
}
/** Local write phase of one chip. */
export type PromptTogglePhase = 'idle' | 'busy' | 'failed';
/**
 * One arm control, rendered from plain props.
 * @param props - enabled state, write phase, localized copy, and the click handler.
 * @returns the chip element for either state.
 */
export declare function PromptToggleChip({ enabled, disabled, phase, labels, onToggle }: {
    /** Whether the workspace's prompt is currently armed. */
    enabled: boolean;
    /** Whether the configuration refuses writes right now. */
    disabled: boolean;
    /** Local write phase of this control. */
    phase: PromptTogglePhase;
    /** Localized copy for both states. */
    labels: PromptToggleLabels;
    /** Ask for the opposite state. */
    onToggle: (next: boolean) => void;
}): JSX.Element;
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
export declare function WorkspacePromptChipEntry({ sessionId, useSessions, usePrompts, toggle, t, }: WorkspacePromptChipProps): JSX.Element | null;
