/**
 * Card-list derivation for the settings overview: merge persisted entries
 * with the locally added (not yet saved) pending rows.
 *
 * Separated from the section component so the merge rule can be unit-tested
 * without React — same pattern as `unconfiguredWorkspaces` in `workspaces.ts`.
 */
import type { WorkspacePromptsEntry } from './stores';
/** One card in the settings overview. */
export interface WorkspacePromptRow {
    /** Absolute workspace directory (the persisted prompt key). */
    cwd: string;
    /** Persisted prompt text ('' for a fresh pending row). */
    text: string;
    /** Fresh row picked from the Add menu (not persisted yet). */
    isNew: boolean;
}
/**
 * Build the card list from persisted entries and pending (unsaved) rows.
 *
 * Invariant: exactly one card per directory. A pending row is rendered only
 * while its directory is still absent from the persisted list, so a save's
 * reload swaps the pending card for the persisted card in the same render —
 * same React key, no duplicate-key frame, and no dependence on a cleanup
 * effect's timing.
 * @param entries - persisted prompts from the settings store.
 * @param pending - directories picked from the Add menu, not yet persisted.
 * @returns the card rows, pending (unsaved) cards first then persisted order.
 */
export declare function mergePromptRows(entries: readonly WorkspacePromptsEntry[], pending: readonly {
    cwd: string;
}[]): WorkspacePromptRow[];
