import type { WorkspacePromptsView } from './config.ts';
/** Live state of the workspace-prompt configuration modal. */
export interface WorkspacePromptModalState {
    /** Whether the modal is currently open. */
    open: boolean;
    /** Absolute workspace directory the modal is editing. */
    cwd: string | undefined;
    /** Current stored prompt text (echoed into the textarea on open). */
    value: string;
    /** Whether the shared config form accepts writes; false disables both actions. */
    writable: boolean;
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
    /** Adopt the shared config form's write permission. */
    setWritable: (writable: boolean) => void;
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
    /** Whether new sessions in this workspace inject the prompt. */
    enabled: boolean;
}
/** Live state of the settings overview listing every configured workspace. */
export interface WorkspacePromptsState {
    /** Configured entries, ordered by workspace directory. */
    entries: readonly WorkspacePromptsEntry[];
    /** Config-form status: `loading` until the Host answers, then `ready` or `unavailable`. */
    status: WorkspacePromptsView['status'];
    /** Whether the Host document accepts writes; false also while unavailable. */
    writable: boolean;
    /** Whether the Host's section carries the arm field; false means it needs a restart. */
    switchSupported: boolean;
}
/** Data verbs for the settings overview, owned by the plugin apply (holds ctx). */
export interface WorkspacePromptsHandlers {
    /** Read the shared config form's current state. */
    view: () => WorkspacePromptsView;
    /** Arm or disarm one workspace's prompt, then republish the list. */
    toggle: (cwd: string, enabled: boolean) => Promise<void>;
}
/**
 * Module-level observable backing the settings overview section, mirroring
 * the {@link WorkspacePromptObservable} pattern: `settings.section` renders
 * through the root-scoped slot machinery, so the command half (which owns
 * `ctx`) writes the read handler here and the section reads state via React's
 * {@link useSyncExternalStore}.
 */
export declare class WorkspacePromptsObservable {
    private readonly listeners;
    private state;
    /** Set by the command half at activation; undefined only before first activation. */
    handlers: WorkspacePromptsHandlers | undefined;
    getSnapshot: () => WorkspacePromptsState;
    subscribe: (listener: () => void) => (() => void);
    /**
     * Replace the live state from one config-form read. Empty prompts are
     * dropped and entries are ordered by workspace directory.
     * @param view - status, write permission, prompts, and arm switches read from the form.
     */
    adopt: (view: WorkspacePromptsView) => void;
    /** Re-read the shared config form (no-op before activation). */
    refresh: () => Promise<void>;
    private emit;
}
/** Single instance shared by the command half (writer) and the settings section (reader). */
export declare const workspacePrompts: WorkspacePromptsObservable;
