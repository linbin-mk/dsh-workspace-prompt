/**
 * Workspace picker support for the settings overview: which registered
 * workspaces still have no configured prompt.
 *
 * The section reads the live workspace list through the `useWorkspaces`
 * standard hook (global slot seat) and the persisted prompts through its own
 * store; this module holds the pure selection logic between the two so it can
 * be unit-tested without React or a wire client.
 */
/** Minimal structural view of one workspace row the picker needs. */
export interface WorkspaceForPicker {
    workspaceId: string;
    /** Canonical workspace directory (== the prompt's cwd key). */
    path: string;
    /** Display title (basename default, user-renamable). */
    title: string;
}
/** One selectable "no prompt yet" workspace row. */
export interface UnconfiguredWorkspace {
    workspaceId: string;
    /** Canonical workspace directory; the prompt is persisted under this key. */
    path: string;
    title: string;
}
/**
 * Filter the workspace list down to workspaces without a configured prompt,
 * excluding the paths already being edited (pending rows) as well. Stable
 * display order: title localeCompare, ties by path localeCompare.
 * @param workspaces - every registered workspace (`useWorkspaces` items).
 * @param excludedPaths - paths that must not appear (configured + pending).
 * @returns the selectable rows, sorted by title then path.
 */
export declare function unconfiguredWorkspaces(workspaces: readonly WorkspaceForPicker[], excludedPaths: ReadonlySet<string>): UnconfiguredWorkspace[];
