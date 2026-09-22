/**
 * Workspace-prompt plugin (client half).
 *
 * Feature 1 (configuration entry): registers a `/workspace-prompt` slash
 * command. Selecting it reads the current workspace's stored prompt from this
 * plugin's shared config form and opens a frame-wide modal (`shell.overlay`)
 * with a textarea plus Save/Clear buttons. Save and Clear write back through
 * the same form, so the value the modal echoes next time and the value the
 * host injects come from one persisted source.
 *
 * Feature 4 (settings overview): registers a `settings.section` navigation
 * entry inside the settings panel. The page lists every configured workspace
 * prompt and supports in-place modification and removal, writing through the
 * same form. An **Add workspace** picker (fed by the `useWorkspaces`
 * standard hook) offers the registered workspaces that have no prompt yet,
 * and picks one into a fresh editable row.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type WorkspacePromptKey } from './locales';
export declare const inject: string[];
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'workspace-prompt': WorkspacePromptKey;
    }
}
/**
 * Client plugin body: locale, the overlay modal, the slash command, and the
 * settings overview entry.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
