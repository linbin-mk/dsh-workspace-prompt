/**
 * Settings overview page for the workspace-prompt plugin.
 *
 * Registered by the client plugin body as a `settings.section` contribution,
 * so it appears as its own navigation row inside the settings panel. It lists
 * every workspace with a configured prompt — read from the shared config form —
 * with in-place edit (Save) and removal (Clear) per row, plus an
 * **Add workspace** picker: workspaces without a prompt are offered in a
 * dropdown (from the live workspace list behind the `useWorkspaces` standard
 * hook), picking one opens a fresh editable row. The card list is derived in
 * one pass ({@link mergePromptRows}) — exactly one card per directory, so a
 * save's reload swaps the pending card for the persisted card atomically
 * instead of briefly rendering both. The page remounts on every visit (the
 * settings shell renders only the active section), so it always starts from a
 * fresh read of the shared form, and every write surface stays disabled while
 * the form is loading or the Host document refuses writes.
 */
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkspacePromptsState } from './stores';
/** Registrant-side business face for the settings overview section. */
export interface WorkspacePromptsSectionInjected {
    hooks: {
        prompts: HostObservable<WorkspacePromptsState>;
    };
    /** Reload the overview from the persisted prompts. */
    refresh: () => Promise<void>;
    /** Persist (or replace) one workspace prompt, then reload. */
    save: (cwd: string, text: string) => Promise<void>;
    /** Remove one workspace prompt, then reload. */
    clear: (cwd: string) => Promise<void>;
}
/** Component props composed by the slot machinery for the section entry. */
export type WorkspacePromptsSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'workspace-prompt'> & InjectFace<WorkspacePromptsSectionInjected>;
/**
 * Render the workspace-prompt settings page.
 * @param props - composed slot props (client plugin registration).
 * @returns the overview element tree.
 */
export declare function WorkspacePromptsSection({ usePrompts, useWorkspaces, refresh, save, clear, t, }: WorkspacePromptsSectionProps): JSX.Element;
