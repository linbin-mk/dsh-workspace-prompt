/**
 * Config-form plumbing for the workspace-prompt client half.
 *
 * The browser half owns no settings document of its own: it reads and edits
 * this plugin's Config through the shared configuration form
 * (`ctx.configForms.get(ENTRY_ID)`), which mirrors the Host document, fences
 * and serializes every write, and republishes each accepted answer. These
 * verbs are separated from the plugin body so they can be unit-tested without
 * React or a wire client — the same split `rows.ts` and `workspaces.ts` use
 * for the settings overview's pure logic.
 */

import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { PROMPTS_FIELD, type WorkspacePromptSettings } from '../prompt-settings.ts'

/** The settings overview's read of the shared config form. */
export interface WorkspacePromptsView {
  /**
   * `loading` before the first Host answer, `ready` once one stands, and
   * `unavailable` when the Host serves no config for this entry.
   */
  status: ConfigFormSnapshot<WorkspacePromptSettings>['status']
  /** Whether the Host document accepts writes; memory mode never does. */
  writable: boolean
  /** Configured prompt text by absolute workspace directory. */
  prompts: Record<string, string>
}

/**
 * Project one config-form snapshot into the overview's vocabulary.
 * @param snapshot - current shared config-form snapshot.
 * @returns the status, write permission, and prompts the overview renders.
 */
export function promptsView(snapshot: ConfigFormSnapshot<WorkspacePromptSettings>): WorkspacePromptsView {
  return {
    status: snapshot.status,
    writable: snapshot.writable,
    prompts: snapshot.value?.prompts ?? {},
  }
}

/**
 * Read the stored prompt for one workspace directory.
 * @param form - shared config form for this plugin's entry.
 * @param cwd - absolute workspace directory.
 * @returns the stored prompt, or an empty string when none is configured.
 */
export function promptFor(form: ConfigForm<WorkspacePromptSettings>, cwd: string): string {
  return form.getSnapshot().value?.prompts[cwd] ?? ''
}

/**
 * Store (or replace) one workspace prompt.
 * @param form - shared config form for this plugin's entry.
 * @param cwd - absolute workspace directory.
 * @param text - prompt text to persist.
 * @returns whether the Host accepted the write (false for a refusal or a skipped write).
 */
export function setPrompt(
  form: ConfigForm<WorkspacePromptSettings>,
  cwd: string,
  text: string,
): Promise<boolean> {
  return form.mutate([{ op: 'set', path: [PROMPTS_FIELD, cwd], value: text }])
}

/**
 * Remove one workspace prompt.
 * @param form - shared config form for this plugin's entry.
 * @param cwd - absolute workspace directory.
 * @returns whether the Host accepted the clear (false for a refusal or a skipped write).
 */
export function unsetPrompt(
  form: ConfigForm<WorkspacePromptSettings>,
  cwd: string,
): Promise<boolean> {
  return form.mutate([{ op: 'unset', path: [PROMPTS_FIELD, cwd] }])
}
