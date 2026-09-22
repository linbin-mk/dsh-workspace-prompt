/** Live state of the workspace-prompt configuration modal. */
export interface WorkspacePromptModalState {
    /** Whether the modal is currently open. */
    open: boolean;
    /** Absolute workspace directory the modal is editing. */
    cwd: string | undefined;
    /** Current stored prompt text (echoed into the textarea on open). */
    value: string;
}
/** Persist/clear callbacks owned by the command half (which holds `ctx`). */
export interface WorkspacePromptHandlers {
    /** Persist (or replace) the prompt for one workspace directory. */
    save: (cwd: string, text: string) => Promise<void>;
    /** Remove the configured prompt for one workspace directory. */
    clear: (cwd: string) => Promise<void>;
}
/**
 * Module-level observable backing the modal. `shell.overlay` is a root-scoped
 * slot, and the renderer does not deliver a per-entry `inject` face for
 * root-scoped entries — so the command half (which owns `ctx`) writes the open
 * signal and the persist handlers here, and the modal component reads them via
 * React's {@link useSyncExternalStore}. This avoids the slot inject entirely.
 */
export declare class WorkspacePromptObservable {
    private readonly listeners;
    private state;
    /** Set by the command half at activation; undefined only before first activation. */
    handlers: WorkspacePromptHandlers | undefined;
    getSnapshot: () => WorkspacePromptModalState;
    subscribe: (listener: () => void) => (() => void);
    open: (cwd: string, value: string) => void;
    close: () => void;
    private emit;
}
/** Single instance shared by the command half (writer) and the modal (reader). */
export declare const workspacePromptModal: WorkspacePromptObservable;
/** One configured workspace row in the settings overview. */
export interface WorkspacePromptsEntry {
    /** Absolute workspace directory. */
    cwd: string;
    /** Configured prompt text. */
    text: string;
}
/** Live state of the settings overview listing every configured workspace. */
export interface WorkspacePromptsState {
    /** Configured entries, ordered by workspace directory. */
    entries: readonly WorkspacePromptsEntry[];
    /** Whether a list or write operation is in flight. */
    busy: boolean;
    /** Error message of the last failed operation, if any. */
    error: string | null;
}
/** Data verbs for the settings overview, owned by the plugin apply (holds ctx). */
export interface WorkspacePromptsHandlers {
    /** Read every configured workspace prompt from persisted settings. */
    list: () => Promise<Record<string, string>>;
}
/**
 * Module-level observable backing the settings overview section, mirroring
 * the {@link WorkspacePromptObservable} pattern: `settings.section` renders
 * through the root-scoped slot machinery, so the command half (which owns
 * `ctx`) writes the read handlers here and the section reads state via
 * React's {@link useSyncExternalStore}.
 */
export declare class WorkspacePromptsObservable {
    private readonly listeners;
    private state;
    /** Set by the command half at activation; undefined only before first activation. */
    handlers: WorkspacePromptsHandlers | undefined;
    getSnapshot: () => WorkspacePromptsState;
    subscribe: (listener: () => void) => (() => void);
    /** Reload the overview from the persisted prompts (no-op before activation). */
    refresh: () => Promise<void>;
    private emit;
}
/** Single instance shared by the command half (writer) and the settings section (reader). */
export declare const workspacePrompts: WorkspacePromptsObservable;
