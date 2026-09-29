/**
 * Pure host injection logic for the workspace-prompt plugin.
 *
 * This module carries the message source declaration, the inbox-reconciliation
 * rules, and the message-building rules with no Cordis runtime imports, so the
 * behaviour is unit-testable without booting a Cordis app. The `apply`
 * entrypoint in `index.ts` wires these helpers onto the live `agent/pre-step`
 * hook and this plugin's Config.
 */
import type { ContextFormed, UserMessage } from '@deepseek-ai/dsh-llm';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        /**
         * Standing per-workspace guidance the user configured. The kind is this
         * plugin's own identity (`identity.ts`), never a shared catch-all; the
         * content is instructions the model is expected to follow, so it declares
         * the `instructions` context form and consumers present the row from it.
         */
        'workspace-prompt': {
            kind: 'workspace-prompt';
        } & ContextFormed;
    }
}
/** Wrap a raw prompt in the same `<system-reminder>` framing the model reads. */
export declare function renderPrompt(text: string): string;
/** Two messages with identical content blocks compare equal for inbox purposes. */
export declare function sameContent(a: UserMessage, b: UserMessage): boolean;
/**
 * Build the context message injected for one workspace prompt.
 * @param text - the raw configured prompt.
 * @returns an immutable user-role message carrying the rendered prompt.
 */
export declare function buildMessage(text: string): UserMessage;
/**
 * Read one workspace's prompt out of the live `prompts` value.
 *
 * The map reaches the Host from a profile document that a user may hand-edit,
 * so its contents are narrowed rather than trusted: a section that is not a
 * plain object, or an entry that is not a string, yields no prompt instead of
 * breaking the step.
 * @param prompts - the live `prompts` Config field value.
 * @param cwd - absolute workspace directory.
 * @returns the configured prompt, or undefined when none stands.
 */
export declare function promptFor(prompts: unknown, cwd: string): string | undefined;
/**
 * Whether one workspace's prompt is armed for injection.
 *
 * The switch defaults to off: a configured prompt enters the model context
 * only after the user turns the composer's workspace-prompt control on for
 * that workspace. Narrowed like {@link promptFor}, so a hand-edited document
 * cannot arm anything by accident.
 * @param enabled - the live `enabled` Config field value.
 * @param cwd - absolute workspace directory.
 * @returns true only for an explicit `true` entry of that directory.
 */
export declare function enabledFor(enabled: unknown, cwd: string): boolean;
/** Minimal session surface the injection logic reads to detect prior injections. */
export interface SurfaceLike {
    /** Surface event sequences in model-visible order. */
    nodes: readonly number[];
    /** Session events indexed by sequence. */
    events: ReadonlyArray<SessionEvent | undefined>;
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
export declare function surfaceSupplies(surface: SurfaceLike, desired: UserMessage): boolean;
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
export declare function syncInbox(inbox: InboxLike, claimed: readonly UserMessage[], isOurs: (message: UserMessage) => boolean, desired: UserMessage | undefined, surface: SurfaceLike | undefined): void;
/** Minimal inbox surface the injection logic touches. */
export interface InboxLike {
    nextStep: readonly UserMessage[];
    remove(id: string): void;
    prepend(target: 'next-step', message: UserMessage): void;
    replace(id: string, message: UserMessage): void;
}
