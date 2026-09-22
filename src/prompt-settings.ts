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
export const ENTRY_ID = 'workspace-prompt'

/** Config field carrying the per-workspace prompts map. */
export const PROMPTS_FIELD = 'prompts'

/** Persisted prompts, keyed by absolute workspace directory. */
export interface WorkspacePromptSettings {
  /** Absolute workspace directory -> configured prompt text. */
  [PROMPTS_FIELD]: Record<string, string>
}
