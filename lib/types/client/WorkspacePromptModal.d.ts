/**
 * Frame-wide modal (registered into `shell.overlay`) that edits the prompt
 * configured for the workspace the current session runs in. Opened by the
 * `/workspace-prompt` slash command; saves and clears through the persist
 * handlers the command half registered on the shared observable, and disables
 * both actions while the shared config form refuses writes.
 *
 * It reads its state from the module-level {@link workspacePromptModal}
 * observable via `useSyncExternalStore` — `shell.overlay` is a root-scoped
 * slot that does not deliver a per-entry `inject` face, so the modal cannot
 * receive data through slot props.
 */
export declare function WorkspacePromptModal(): JSX.Element | null;
