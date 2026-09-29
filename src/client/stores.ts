import type { WorkspacePromptsView } from './config.ts'

/** Live state of the workspace-prompt configuration modal. */
export interface WorkspacePromptModalState {
  /** Whether the modal is currently open. */
  open: boolean
  /** Absolute workspace directory the modal is editing. */
  cwd: string | undefined
  /** Current stored prompt text (echoed into the textarea on open). */
  value: string
  /** Whether the shared config form accepts writes; false disables both actions. */
  writable: boolean
}

/** Persist/clear callbacks owned by the command half (which holds `ctx`). */
export interface WorkspacePromptHandlers {
  /** Persist (or replace) the prompt for one workspace directory. */
  save: (cwd: string, text: string) => Promise<void>
  /** Remove the configured prompt for one workspace directory. */
  clear: (cwd: string) => Promise<void>
}

/**
 * Module-level observable backing the modal. `shell.overlay` is a root-scoped
 * slot, and the renderer does not deliver a per-entry `inject` face for
 * root-scoped entries — so the command half (which owns `ctx`) writes the open
 * signal and the persist handlers here, and the modal component reads them via
 * React's {@link useSyncExternalStore}. This avoids the slot inject entirely.
 */
export class WorkspacePromptObservable {
  private readonly listeners = new Set<() => void>()
  private state: WorkspacePromptModalState = { open: false, cwd: undefined, value: '', writable: false }
  /** Set by the command half at activation; undefined only before first activation. */
  handlers: WorkspacePromptHandlers | undefined

  getSnapshot = (): WorkspacePromptModalState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  open = (cwd: string, value: string): void => {
    this.state = { ...this.state, open: true, cwd, value }
    this.emit()
  }

  close = (): void => {
    this.state = { ...this.state, open: false }
    this.emit()
  }

  /** Adopt the shared config form's write permission. */
  setWritable = (writable: boolean): void => {
    if (this.state.writable === writable) return
    this.state = { ...this.state, writable }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

/** Single instance shared by the command half (writer) and the modal (reader). */
export const workspacePromptModal = new WorkspacePromptObservable()

/** One configured workspace row in the settings overview. */
export interface WorkspacePromptsEntry {
  /** Absolute workspace directory. */
  cwd: string
  /** Configured prompt text. */
  text: string
  /** Whether new sessions in this workspace inject the prompt. */
  enabled: boolean
}

/** Live state of the settings overview listing every configured workspace. */
export interface WorkspacePromptsState {
  /** Configured entries, ordered by workspace directory. */
  entries: readonly WorkspacePromptsEntry[]
  /** Config-form status: `loading` until the Host answers, then `ready` or `unavailable`. */
  status: WorkspacePromptsView['status']
  /** Whether the Host document accepts writes; false also while unavailable. */
  writable: boolean
  /** Whether the Host's section carries the arm field; false means it needs a restart. */
  switchSupported: boolean
}

/** Data verbs for the settings overview, owned by the plugin apply (holds ctx). */
export interface WorkspacePromptsHandlers {
  /** Read the shared config form's current state. */
  view: () => WorkspacePromptsView
  /** Arm or disarm one workspace's prompt, then republish the list. */
  toggle: (cwd: string, enabled: boolean) => Promise<void>
}

/**
 * Module-level observable backing the settings overview section, mirroring
 * the {@link WorkspacePromptObservable} pattern: `settings.section` renders
 * through the root-scoped slot machinery, so the command half (which owns
 * `ctx`) writes the read handler here and the section reads state via React's
 * {@link useSyncExternalStore}.
 */
export class WorkspacePromptsObservable {
  private readonly listeners = new Set<() => void>()
  private state: WorkspacePromptsState = { entries: [], status: 'loading', writable: false, switchSupported: true }
  /** Set by the command half at activation; undefined only before first activation. */
  handlers: WorkspacePromptsHandlers | undefined

  getSnapshot = (): WorkspacePromptsState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Replace the live state from one config-form read. Empty prompts are
   * dropped and entries are ordered by workspace directory.
   * @param view - status, write permission, prompts, and arm switches read from the form.
   */
  adopt = (view: WorkspacePromptsView): void => {
    this.state = {
      entries: Object.entries(view.prompts)
        .filter(([, text]) => text.length > 0)
        .map(([cwd, text]) => ({ cwd, text, enabled: view.enabled[cwd] === true }))
        .sort((a, b) => a.cwd.localeCompare(b.cwd)),
      status: view.status,
      writable: view.writable,
      switchSupported: view.switchSupported,
    }
    this.emit()
  }

  /** Re-read the shared config form (no-op before activation). */
  refresh = async (): Promise<void> => {
    const view = this.handlers?.view
    if (view === undefined) return
    this.adopt(view())
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

/** Single instance shared by the command half (writer) and the settings section (reader). */
export const workspacePrompts = new WorkspacePromptsObservable()
