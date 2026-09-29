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
 * Feature 2 (arm control): registers a chip into `conversation.input.left` —
 * the composer tool row, right of the permission and plan controls. The chip
 * shows the current workspace's arm state and flips it through the same form
 * (`enabled`); the Host injects the prompt only while it is on. The chip
 * renders nothing for a workspace with no configured prompt, and its state is
 * per workspace, so arming it in one Session arms the next Session too.
 *
 * Feature 4 (settings overview): registers a `settings.section` navigation
 * entry inside the settings panel. The page lists every configured workspace
 * prompt and supports in-place modification and removal, writing through the
 * same form, plus the same arm chip per row. An **Add workspace** picker (fed
 * by the `useWorkspaces` standard hook) offers the registered workspaces that
 * have no prompt yet, and picks one into a fresh editable row.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ClientSessionContext } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { CommandContribution, SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: the configuration-form service, its Context merge
// (`ctx.configForms`), and the settings slot declarations
// (`settings.section`). Cross-plugin collaboration goes through the service,
// never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the locale Context merge (`ctx.locale.bind`).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ui-layout slot declarations (`shell.overlay`).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: the `conversation.input.left` SlotMap key this plugin occupies.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the session-scope standard seats (`sessionId`, `useSessions`).
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the `ctx.sessions` (session-controller), `ctx.remote`
// (remotes), and `ctx.slots` (ui-renderer) Context merges plus the global
// `useWorkspaces` standard-hook merge (ui-workspace) into this program.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ENTRY_ID, type WorkspacePromptSettings } from '../prompt-settings.ts'
import { promptFor, promptsView, setEnabled, setPrompt, unsetPrompt } from './config.ts'
import { WorkspacePromptModal } from './WorkspacePromptModal'
import { WorkspacePromptChipEntry } from './WorkspacePromptToggle'
import { WorkspacePromptsSection, type WorkspacePromptsSectionInjected } from './WorkspacePromptsSection'
import { workspacePromptModal, workspacePrompts } from './stores'
import { en, zh, type WorkspacePromptKey } from './locales'

export const inject = ['slots', 'commandUi', 'sessions', 'remote', 'configForms', 'locale']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'workspace-prompt': WorkspacePromptKey
  }
}

/** Resolve the absolute working directory of the session the command targets. */
function currentCwd(ctx: ClientContext, sessionId: SessionId): string | undefined {
  return ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
}

/**
 * Client plugin body: locale, the overlay modal, the slash command, and the
 * settings overview entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(ENTRY_ID, { zh, en }), 'workspace-prompt: dictionaries')

  const t = ctx.locale.bind(ENTRY_ID)
  const form = ctx.configForms.get<WorkspacePromptSettings>(ENTRY_ID)

  /** Persist one form write, refusing loudly when the Host does not accept it. */
  const write = async (accepted: Promise<boolean>): Promise<void> => {
    if (!await accepted) throw new Error(t('error.rejected'))
  }
  const save = async (cwd: string, text: string): Promise<void> => {
    await write(setPrompt(form, cwd, text))
  }
  const clear = async (cwd: string): Promise<void> => {
    await write(unsetPrompt(form, cwd))
  }
  /** Arm or disarm one workspace's prompt; the Host gates injection on it. */
  const toggle = async (cwd: string, enabled: boolean): Promise<void> => {
    await write(setEnabled(form, cwd, enabled))
  }
  // Hand the persist verbs to the modal through the shared observable; `shell.overlay`
  // is a root-scoped slot whose entries receive no per-entry inject face.
  workspacePromptModal.handlers = { save, clear }

  // The settings overview reads the same form; every snapshot replacement (a
  // write answer or a Host invalidation) republishes its rows. Its writes are
  // the same verbs followed by a reload.
  workspacePrompts.handlers = {
    view: () => promptsView(form.getSnapshot()),
    toggle: async (cwd, enabled) => {
      await toggle(cwd, enabled)
      await workspacePrompts.refresh()
    },
  }
  const adopt = (): void => {
    const view = promptsView(form.getSnapshot())
    workspacePrompts.adopt(view)
    workspacePromptModal.setWritable(view.writable)
  }
  ctx.effect(() => form.subscribe(adopt), 'workspace-prompt: config form adoption')
  adopt()

  const sectionInjected: WorkspacePromptsSectionInjected = {
    hooks: { prompts: workspacePrompts },
    refresh: () => workspacePrompts.refresh(),
    save: async (cwd, text) => { await save(cwd, text); await workspacePrompts.refresh() },
    clear: async (cwd) => { await clear(cwd); await workspacePrompts.refresh() },
    toggle: async (cwd, enabled) => { await toggle(cwd, enabled); await workspacePrompts.refresh() },
  }

  // The composer arm chip: `conversation.input.left` is a list slot declared by
  // the resident composer bar, so this registration rides that declaration's
  // lifetime. It renders nothing unless the Session's workspace has a prompt.
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: ENTRY_ID,
    order: 0,
    locale: ENTRY_ID,
    inject: () => ({ hooks: { prompts: workspacePrompts }, toggle }),
  }, WorkspacePromptChipEntry))

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
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'workspace-prompt',
    order: 16,
    label: () => t('settings.nav'),
    locale: ENTRY_ID,
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
        // The form answers from the client's mirror of the Host document; wait
        // for its first answer so the modal echoes what the Host stores.
        await ctx.configForms.describe().ensure()
        workspacePromptModal.open(cwd, promptFor(form, cwd))
      },
    },
  }
  ctx.commandUi.register(contribution)
}
