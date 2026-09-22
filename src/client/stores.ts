/** Live state of the workspace-prompt configuration modal. */
export interface WorkspacePromptModalState {
  /** Whether the modal is currently open. */
  open: boolean
  /** Absolute workspace directory the modal is editing. */
  cwd: string | undefined
  /** Current stored prompt text (echoed into the textarea on open). */
  value: string
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
  private state: WorkspacePromptModalState = { open: false, cwd: undefined, value: '' }
  /** Set by the command half at activation; undefined only before first activation. */
  handlers: WorkspacePromptHandlers | undefined

  getSnapshot = (): WorkspacePromptModalState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  open = (cwd: string, value: string): void => {
    this.state = { open: true, cwd, value }
    this.emit()
  }

  close = (): void => {
    this.state = { ...this.state, open: false }
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
}

/** Live state of the settings overview listing every configured workspace. */
export interface WorkspacePromptsState {
  /** Configured entries, ordered by workspace directory. */
  entries: readonly WorkspacePromptsEntry[]
  /** Whether a list or write operation is in flight. */
  busy: boolean
  /** Error message of the last failed operation, if any. */
  error: string | null
}

/** Data verbs for the settings overview, owned by the plugin apply (holds ctx). */
export interface WorkspacePromptsHandlers {
  /** Read every configured workspace prompt from persisted settings. */
  list: () => Promise<Record<string, string>>
}

/**
 * Module-level observable backing the settings overview section, mirroring
 * the {@link WorkspacePromptObservable} pattern: `settings.section` renders
 * through the root-scoped slot machinery, so the command half (which owns
 * `ctx`) writes the read handlers here and the section reads state via
 * React's {@link useSyncExternalStore}.
 */
export class WorkspacePromptsObservable {
  private readonly listeners = new Set<() => void>()
  private state: WorkspacePromptsState = { entries: [], busy: false, error: null }
  /** Set by the command half at activation; undefined only before first activation. */
  handlers: WorkspacePromptsHandlers | undefined

  getSnapshot = (): WorkspacePromptsState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Reload the overview from the persisted prompts (no-op before activation). */
  refresh = async (): Promise<void> => {
    const list = this.handlers?.list
    if (list === undefined) return
    this.state = { ...this.state, busy: true, error: null }
    this.emit()
    try {
      const prompts = await list()
      this.state = {
        busy: false,
        error: null,
        entries: Object.entries(prompts)
          .filter(([, text]) => text.length > 0)
          .map(([cwd, text]) => ({ cwd, text }))
          .sort((a, b) => a.cwd.localeCompare(b.cwd)),
      }
    } catch (cause) {
      this.state = {
        ...this.state,
        busy: false,
        error: cause instanceof Error ? cause.message : String(cause),
      }
    }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

/** Single instance shared by the command half (writer) and the settings section (reader). */
export const workspacePrompts = new WorkspacePromptsObservable()
