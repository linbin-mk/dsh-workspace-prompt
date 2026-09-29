/**
 * Configuration identity shared by the host and client halves.
 *
 * The profile entry id in `cordis.patch.yml` names the loader row, and the
 * Host maps this plugin's Config onto that same id as the settings namespace,
 * so the browser half addresses one entry through `ctx.configForms.get`. The
 * host half declares the Cordis Config schema over
 * {@link WorkspacePromptSettings}; the client half reads and edits that
 * section path by path.
 */
/** Profile entry id owning this plugin's Config; also its settings namespace. */
export declare const ENTRY_ID = "workspace-prompt";
/** Config field carrying the per-workspace prompts map. */
export declare const PROMPTS_FIELD = "prompts";
/**
 * Config field carrying the per-workspace arm switch. A configured prompt is
 * injected only while its workspace's entry here is `true`, so saving a prompt
 * never changes what the next session receives by itself.
 */
export declare const ENABLED_FIELD = "enabled";
/** Persisted prompts and their arm switch, keyed by absolute workspace directory. */
export interface WorkspacePromptSettings {
    /** Absolute workspace directory -> configured prompt text. */
    [PROMPTS_FIELD]: Record<string, string>;
    /** Absolute workspace directory -> whether that workspace's prompt is armed. */
    [ENABLED_FIELD]: Record<string, boolean>;
}
