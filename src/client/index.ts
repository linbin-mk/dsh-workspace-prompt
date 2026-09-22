/**
 * Workspace-prompt plugin (client half).
 *
 * Feature 1 (configuration entry): registers a `/workspace-prompt` slash
 * command. Selecting it reads the current workspace's stored prompt through
 * the Host settings RPC and opens a frame-wide modal (`shell.overlay`) with a
 * textarea plus Save/Clear buttons. Save and Clear write back through the
 * same Host settings RPC, so the value the modal echoes next time and the
 * value the host injects come from one persisted source.
 *
 * Feature 4 (settings overview): registers a `settings.section` navigation
 * entry inside the settings panel. The page lists every configured workspace
 * prompt and supports in-place modification and removal, writing through the
 * same Host settings RPC. An **Add workspace** picker (fed by the
 * `useWorkspaces` standard hook) offers the registered workspaces that have
 * no prompt yet, and picks one into a fresh editable row.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ClientSessionContext } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { CommandContribution, SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-settings/types'
// Type-only: the settings slot declarations (`settings.section`), the locale
// Context merge (`ctx.locale.bind`), and the ui-layout slot declarations
// (`shell.overlay`). Cross-plugin collaboration goes through the service,
// never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the `ctx.sessions` (session-controller), `ctx.remote`
// (remotes), and `ctx.slots` (ui-renderer) Context merges plus the global
// `useWorkspaces` standard-hook merge (ui-workspace) into this program.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { WorkspacePromptModal } from './WorkspacePromptModal'
import { WorkspacePromptsSection, type WorkspacePromptsSectionInjected } from './WorkspacePromptsSection'
import { workspacePromptModal, workspacePrompts } from './stores'
import { en, zh, type WorkspacePromptKey } from './locales'

export const inject = ['slots', 'commandUi', 'sessions', 'remote', 'remote.settings', 'locale']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'workspace-prompt': WorkspacePromptKey
  }
}

/** The settings Remote face the plugin reads and writes through. */
type SettingsApi = ClientRemote['settings']

/** Extract the prompts record from a redacted namespace value (JSON-shaped wire data). */
function readPrompts(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const prompts = (value as { prompts?: unknown }).prompts
  if (prompts === null || typeof prompts !== 'object') return undefined
  return prompts as Record<string, string>
}

/** Resolve the absolute working directory of the session the command targets. */
function currentCwd(ctx: ClientContext, sessionId: SessionId): string | undefined {
  return ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
}

/** Read every configured workspace prompt (cwd -> text) from persisted settings. */
async function readAllPrompts(api: SettingsApi): Promise<Record<string, string>> {
  const response = await api.describe()
  if (!response.ok) throw new Error(response.error.message)
  const namespace = response.value.namespaces.find((view: SettingsNamespaceView) => view.ns === 'workspace-prompt')
  return { ...(readPrompts(namespace?.value) ?? {}) }
}

/** Read the stored prompt for one workspace directory (empty string when none). */
async function readPrompt(api: SettingsApi, cwd: string): Promise<string> {
  return (await readAllPrompts(api))[cwd] ?? ''
}

async function mutatePrompt(
  api: SettingsApi,
  ops: SettingsPathOpView[],
): Promise<void> {
  const response = await api.mutate('workspace-prompt', ops, undefined)
  if (!response.ok) {
    throw new Error(response.error.message)
  }
}

/**
 * Client plugin body: locale, the overlay modal, the slash command, and the
 * settings overview entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('workspace-prompt', { zh, en }), 'workspace-prompt: dictionaries')

  const api = ctx.remote.settings
  const t = ctx.locale.bind('workspace-prompt')

  const save = async (cwd: string, text: string): Promise<void> => {
    await mutatePrompt(api, [{ op: 'set', path: ['prompts', cwd], value: text }])
  }
  const clear = async (cwd: string): Promise<void> => {
    await mutatePrompt(api, [{ op: 'unset', path: ['prompts', cwd] }])
  }
  // Hand the persist verbs to the modal through the shared observable; `shell.overlay`
  // is a root-scoped slot whose entries receive no per-entry inject face.
  workspacePromptModal.handlers = { save, clear }
  // The settings overview reads through the same persisted document; its writes
  // are the same verbs followed by a reload.
  workspacePrompts.handlers = { list: () => readAllPrompts(api) }

  // `shell.overlay` is a list slot declared by ui-layout; inject waits for that
  // declaration, then mounts the modal. The modal reads its open state and the
  // persist handlers from the shared `workspacePromptModal` observable — it gets
  // no data through slot props.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'workspace-prompt',
  }, WorkspacePromptModal))

  // Settings navigation row: `settings.section` is declared by the settings
  // shell (ui-settings-general, shipped with the web app), so this registration
  // adds one more page to the settings panel without touching shell code.
  const sectionInjected: WorkspacePromptsSectionInjected = {
    hooks: { prompts: workspacePrompts },
    refresh: () => workspacePrompts.refresh(),
    save: async (cwd, text) => { await save(cwd, text); await workspacePrompts.refresh() },
    clear: async (cwd) => { await clear(cwd); await workspacePrompts.refresh() },
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'workspace-prompt',
    order: 16,
    label: () => t('settings.nav'),
    locale: 'workspace-prompt',
    inject: () => sectionInjected,
  }, WorkspacePromptsSection))

  const contribution: CommandContribution = {
    name: 'workspace-prompt',
    description: () => t('command.description'),
    available: (session: ClientSessionContext): boolean => currentCwd(ctx, session.sessionId) !== undefined,
    ui: {
      kind: 'popupSelect',
      options: async (): Promise<readonly SelectOption[]> => [
        { id: 'open', label: t('command.open') },
      ],
      onSelect: async (_option: SelectOption, session: ClientSessionContext): Promise<void> => {
        const cwd = currentCwd(ctx, session.sessionId)
        if (cwd === undefined) return
        const value = await readPrompt(api, cwd)
        workspacePromptModal.open(cwd, value)
      },
    },
  }
  ctx.commandUi.register(contribution)
}
