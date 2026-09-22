/**
 * Pure host injection logic for the workspace-prompt plugin.
 *
 * This module carries the message source declaration, the inbox-reconciliation
 * rules, and the message-building rules with no Cordis runtime imports, so the
 * behaviour is unit-testable without booting a Cordis app. The `apply`
 * entrypoint in `index.ts` wires these helpers onto the live `agent/pre-step`
 * hook and this plugin's Config.
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed, UserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { name } from './identity.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /**
     * Standing per-workspace guidance the user configured. The kind is this
     * plugin's own identity (`identity.ts`), never a shared catch-all; the
     * content is instructions the model is expected to follow, so it declares
     * the `instructions` context form and consumers present the row from it.
     */
    'workspace-prompt': { kind: 'workspace-prompt' } & ContextFormed
  }
}

const PROMPT_INTRO =
  'The following workspace-specific prompt was configured by the user for this workspace. '
  + 'Treat it as standing guidance for work in this workspace; it does not override system, '
  + 'developer, or direct user instructions.'

/** Wrap a raw prompt in the same `<system-reminder>` framing the model reads. */
export function renderPrompt(text: string): string {
  return ['<system-reminder>', PROMPT_INTRO, '', text, '</system-reminder>'].join('\n')
}

/** Two messages with identical content blocks compare equal for inbox purposes. */
export function sameContent(a: UserMessage, b: UserMessage): boolean {
  return JSON.stringify(a.content) === JSON.stringify(b.content)
}

/**
 * Build the context message injected for one workspace prompt.
 * @param text - the raw configured prompt.
 * @returns an immutable user-role message carrying the rendered prompt.
 */
export function buildMessage(text: string): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: renderPrompt(text) }],
    source: { kind: name, form: 'instructions' },
  })
}

/** Minimal session surface the injection logic reads to detect prior injections. */
export interface SurfaceLike {
  /** Surface event sequences in model-visible order. */
  nodes: readonly number[]
  /** Session events indexed by sequence. */
  events: ReadonlyArray<SessionEvent | undefined>
}

/** Whether one recorded event carries this plugin's own message with the desired payload. */
function isOwnMessageEvent(event: SessionEvent | undefined, desired: UserMessage): boolean {
  if (event?.type !== 'user/message') return false
  const recorded: UserMessage = event.data
  // Message source kinds are merge-extensible: match this plugin's own kind
  // and leave every other producer's message alone.
  return recorded.source.kind === name && sameContent(recorded, desired)
}

/**
 * Whether the desired message already stands in the recorded session surface.
 *
 * The prompt is injected once, at session start, and then left in the
 * conversation: later steps skip re-injection while an identical copy is
 * still visible. A changed configuration yields a different payload and
 * enters again, as does a copy dropped from the surface (for example by
 * compaction), restoring the standing guidance.
 */
export function surfaceSupplies(surface: SurfaceLike, desired: UserMessage): boolean {
  for (let index = surface.nodes.length - 1; index >= 0; index--) {
    const seq = surface.nodes[index]
    if (seq !== undefined && isOwnMessageEvent(surface.events[seq], desired)) return true
  }
  return false
}

/**
 * Reconcile the plugin's own inbox entries against the desired state.
 *
 * Called after the decision is known. When there is nothing to inject, or the
 * desired message already stands among the claimed messages or in the recorded
 * session surface, every pending entry the plugin owns is removed. Otherwise
 * the pending entries are collapsed onto exactly one `desired` (reused when its
 * content already exists, else replaced or prepended).
 * @param inbox - the agent inbox to reconcile against.
 * @param claimed - messages already claimed into the step (for de-duplication).
 * @param isOurs - recognises the plugin's own pending entries by id.
 * @param desired - the message to ensure is present, or undefined to clear.
 * @param surface - the recorded session surface, or undefined when unknown.
 */
export function syncInbox(
  inbox: InboxLike,
  claimed: readonly UserMessage[],
  isOurs: (message: UserMessage) => boolean,
  desired: UserMessage | undefined,
  surface: SurfaceLike | undefined,
): void {
  const pending = inbox.nextStep.filter(isOurs)
  const supplied = desired !== undefined && (
    claimed.some(message => sameContent(message, desired))
    || surface !== undefined && surfaceSupplies(surface, desired)
  )
  if (desired === undefined || supplied) {
    for (const message of pending) inbox.remove(message.id)
    return
  }
  const reusable = pending.find(message => sameContent(message, desired))
  if (reusable !== undefined) {
    for (const message of pending) {
      if (message.id !== reusable.id) inbox.remove(message.id)
    }
    return
  }
  const replaced = pending[0]
  if (replaced === undefined) inbox.prepend('next-step', desired)
  else inbox.replace(replaced.id, desired)
  for (const message of pending.slice(1)) inbox.remove(message.id)
}

/** Minimal inbox surface the injection logic touches. */
export interface InboxLike {
  nextStep: readonly UserMessage[]
  remove(id: string): void
  prepend(target: 'next-step', message: UserMessage): void
  replace(id: string, message: UserMessage): void
}
