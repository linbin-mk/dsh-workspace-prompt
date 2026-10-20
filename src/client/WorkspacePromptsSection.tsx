/**
 * Settings overview page for the workspace-prompt plugin.
 *
 * Registered by the client plugin body as a `settings.section` contribution,
 * so it appears as its own navigation row inside the settings panel. The page
 * keeps the plugin's original verbs — add a workspace from a picker menu,
 * switch a workspace's prompt on or off, save or clear inside an editor — on
 * the settings-page design language of `dsh-session-sync`: one card, hairline
 * separated workspace rows, and an inline editor that opens under its row.
 *
 * Configured workspaces come first (sorted by title), then one divider, then
 * the registered workspaces without a prompt. Unconfigured rows are read-only:
 * adding a prompt goes through the original Add menu in the card header.
 *
 * The card list is derived in one pass ({@link mergePromptRows}) — exactly one
 * row per directory, so a save's reload swaps the pending row for the persisted
 * row atomically. The page remounts on every visit (the settings shell renders
 * only the active section), so it always starts from a fresh read of the shared
 * form, and every write surface stays disabled while the form is loading or the
 * Host document refuses writes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button, IconChevronRightOutlineRegular, IconFolderCloseRegular, IconPlusOutlineRegular, Menu, Switch,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspacePromptsState } from './stores'
import { mergePromptRows, type WorkspacePromptRow } from './rows'
import { unconfiguredWorkspaces, type WorkspaceForPicker } from './workspaces'
import css from './WorkspacePromptsSection.module.css'

/** Registrant-side business face for the settings overview section. */
export interface WorkspacePromptsSectionInjected {
  hooks: { prompts: HostObservable<WorkspacePromptsState> }
  /** Reload the overview from the persisted prompts. */
  refresh: () => Promise<void>
  /** Persist (or replace) one workspace prompt, then reload. */
  save: (cwd: string, text: string) => Promise<void>
  /** Remove one workspace prompt, then reload. */
  clear: (cwd: string) => Promise<void>
  /** Arm or disarm one workspace's prompt, then reload. */
  toggle: (cwd: string, enabled: boolean) => Promise<void>
}

/** Component props composed by the slot machinery for the section entry. */
export type WorkspacePromptsSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'workspace-prompt'>
  & InjectFace<WorkspacePromptsSectionInjected>

/** The workspace list as the `useWorkspaces` standard hook publishes it. */
interface WorkspacesSnapshot {
  items: readonly WorkspaceForPicker[]
  phase: string
}

/** Last path segment of an absolute directory (title fallback for orphaned prompts). */
function basenameOf(cwd: string): string {
  return cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? cwd
}

/** One-line preview of a possibly multi-line prompt. */
function previewOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** User-perceived character count (surrogate pairs count once). */
function charCount(text: string): number {
  return Array.from(text).length
}

/** A failure's message, whether it arrived as an Error or as anything else. */
function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/** Two-line menu row: workspace title over its canonical path. */
function workspaceItemLabel(name: string, path: string): ReactNode {
  return (
    <span className={css.pickerItem}>
      <span className={css.pickerTitle}>{name}</span>
      <span className={css.pickerPath}>{path}</span>
    </span>
  )
}

/** Props of one configured (or pending) workspace row. */
interface PromptRowProps {
  row: WorkspacePromptRow
  name: string
  open: boolean
  draft: string
  busy: boolean
  disabled: boolean
  switchBusy: boolean
  switchReason: 'none' | 'readonly' | 'skew'
  switchTitle: string | undefined
  switchError: boolean
  flash: boolean
  error: string | null
  t: TranslateNS<'workspace-prompt'>
  onOpen: () => void
  onDraft: (text: string) => void
  onSave: () => void
  onClear: () => void
  onCancel: () => void
  onSwitch: (next: boolean) => void
}

/**
 * One workspace row plus the editor that opens under it.
 * @param props - row data, draft state, write state, and row actions.
 * @returns the row and its inline editor when open.
 */
function PromptRow({
  row, name, open, draft, busy, disabled, switchBusy, switchReason, switchTitle, switchError, flash, error,
  t, onOpen, onDraft, onSave, onClear, onCancel, onSwitch,
}: PromptRowProps): JSX.Element {
  const preview = row.isNew ? t('settings.pendingPreview') : previewOf(row.text)
  const stateLabel = row.enabled ? t('settings.on') : t('settings.off')
  const canSave = !busy && !disabled && draft.trim() !== ''
    && (row.isNew || draft !== row.text)
  return (
    <div className={css.item} data-flash={flash ? 'true' : undefined}>
      <div
        className={css.row}
        data-open={open ? 'true' : undefined}
        data-pending={row.isNew ? 'true' : undefined}
        data-enabled={row.isNew ? undefined : row.enabled}
      >
        <button
          type="button"
          className={css.rowMain}
          aria-expanded={open}
          title={row.cwd}
          onClick={onOpen}
        >
          <span className={css.folder}><IconFolderCloseRegular /></span>
          <span className={css.rowText}>
            <span className={css.rowTitle}>{name}</span>
            <span className={css.rowPreview}>{preview}</span>
            {switchError && (
              <span className={css.rowError} role="alert">{t('settings.toggleError')}</span>
            )}
          </span>
        </button>
        {row.isNew
          ? <span className={css.tagNew}>{t('settings.new')}</span>
          : (
            <>
              <span className={css.rowState}>{stateLabel}</span>
              <Switch
                checked={row.enabled}
                disabled={busy || switchBusy || switchReason !== 'none'}
                label={t('settings.toggleAria').replace('{name}', name)}
                title={switchTitle}
                onChange={onSwitch}
              />
            </>
          )}
        <span className={css.chevron} aria-hidden="true"><IconChevronRightOutlineRegular /></span>
      </div>
      {open && (
        <div className={css.editor}>
          <div className={css.editorHead}>
            <span className={css.editorLabel}>{t('settings.editorLabel')}</span>
            <span className={css.editorCount}>
              {t('settings.charCount').replace('{count}', String(charCount(draft)))}
            </span>
          </div>
          <textarea
            className={css.textarea}
            value={draft}
            rows={4}
            autoFocus
            disabled={busy || disabled}
            placeholder={t('settings.placeholder')}
            onChange={(event) => { onDraft(event.target.value) }}
          />
          <div className={css.editorFoot}>
            <p className={css.hint}>{t('settings.editorHint')}</p>
            <div className={css.editorActions}>
              {row.isNew
                ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
                    {t('settings.cancel')}
                  </Button>
                )
                : (
                  <Button
                    variant="outline" size="sm" className={css.danger}
                    disabled={busy || disabled} onClick={onClear}
                  >
                    {t('settings.clear')}
                  </Button>
                )}
              <Button variant="primary" size="sm" disabled={!canSave} onClick={onSave}>
                {t('settings.save')}
              </Button>
            </div>
          </div>
          {error !== null && (
            <p className={css.error} role="alert">
              {t('settings.error').replace('{message}', error)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Props of one read-only unconfigured workspace row. */
interface EmptyRowProps {
  name: string
  cwd: string
  flash: boolean
  t: TranslateNS<'workspace-prompt'>
}

/**
 * A registered workspace without a prompt. Its only verb is the card's Add
 * menu, so the row renders no control of its own.
 * @param props - workspace name/path, flash state, and copy.
 * @returns the read-only row.
 */
function EmptyRow({ name, cwd, flash, t }: EmptyRowProps): JSX.Element {
  return (
    <div className={css.item} data-flash={flash ? 'true' : undefined}>
      <div className={css.row} data-unconfigured="true">
        <div className={`${css.rowMain} ${css.rowMainStatic}`} title={cwd}>
          <span className={css.folder}><IconFolderCloseRegular /></span>
          <span className={css.rowText}>
            <span className={css.rowTitle}>{name}</span>
            <span className={`${css.rowPreview} ${css.rowPreviewMono}`}>{cwd}</span>
          </span>
        </div>
        <span className={`${css.rowState} ${css.rowStateMuted}`}>{t('settings.unconfigured')}</span>
      </div>
    </div>
  )
}

/**
 * Render the workspace-prompt settings page.
 * @param props - composed slot props (client plugin registration).
 * @returns the overview element tree.
 */
export function WorkspacePromptsSection({
  usePrompts, useWorkspaces, refresh, save, clear, toggle, t,
}: WorkspacePromptsSectionProps): JSX.Element {
  const state: WorkspacePromptsState = usePrompts((value: WorkspacePromptsState) => value)
  const workspaces: WorkspacesSnapshot = useWorkspaces((value: WorkspacesSnapshot) => value)
  const [pending, setPending] = useState<readonly { cwd: string }[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openCwd, setOpenCwd] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toggleBusy, setToggleBusy] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [flashCwd, setFlashCwd] = useState<string | null>(null)

  // The section mounts on each visit to the settings page: start from a fresh read.
  useEffect(() => { void refresh() }, [refresh])

  // Once a reload accounts a pending row's prompt, drop it from the local list.
  useEffect(() => {
    setPending(previous => previous.filter(row => !state.entries.some(entry => entry.cwd === row.cwd)))
  }, [state.entries])

  // An externally removed prompt closes its editor instead of leaving a stale one.
  useEffect(() => {
    if (openCwd === undefined) return
    const persisted = state.entries.some(entry => entry.cwd === openCwd)
    const isPending = pending.some(row => row.cwd === openCwd)
    if (persisted || isPending) return
    setOpenCwd(undefined)
    setDraft('')
    setError(null)
  }, [openCwd, pending, state.entries])

  // The save/clear highlight fades on its own.
  useEffect(() => {
    if (flashCwd === null) return
    const timer = setTimeout(() => { setFlashCwd(null) }, 1200)
    return () => { clearTimeout(timer) }
  }, [flashCwd])

  // A refused switch reports itself for a moment, then clears.
  useEffect(() => {
    if (toggleError === null) return
    const timer = setTimeout(() => { setToggleError(null) }, 2600)
    return () => { clearTimeout(timer) }
  }, [toggleError])

  const titleByPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const workspace of workspaces.items) map.set(workspace.path, workspace.title)
    return map
  }, [workspaces.items])

  const nameFor = useCallback(
    (cwd: string): string => titleByPath.get(cwd) ?? basenameOf(cwd),
    [titleByPath],
  )

  const rows = useMemo(
    () => mergePromptRows(state.entries, pending),
    [pending, state.entries],
  )

  // Configured workspaces first, each group by title; a freshly added row stays
  // at the top until it is saved, mirroring the original page's pending card.
  const orderedRows = useMemo(() => {
    const byName = (a: WorkspacePromptRow, b: WorkspacePromptRow): number =>
      nameFor(a.cwd).localeCompare(nameFor(b.cwd)) || a.cwd.localeCompare(b.cwd)
    return [
      ...rows.filter(row => row.isNew).sort(byName),
      ...rows.filter(row => !row.isNew).sort(byName),
    ]
  }, [nameFor, rows])

  const configuredPaths = useMemo<ReadonlySet<string>>(
    () => new Set(state.entries.map(entry => entry.cwd)),
    [state.entries],
  )
  const excludedPaths = useMemo(
    () => new Set<string>([...configuredPaths, ...pending.map(row => row.cwd)]),
    [configuredPaths, pending],
  )
  const addable = useMemo(
    () => unconfiguredWorkspaces(workspaces.items, excludedPaths),
    [workspaces.items, excludedPaths],
  )

  const workspacesReady = workspaces.phase === 'ready'
  const loading = state.status === 'loading'
  const disabled = loading || !state.writable
  // An upgraded browser half talking to a Host that has not been restarted
  // finds no arm field in the resolved section; saying so beats a refusal.
  const switchReason: 'none' | 'readonly' | 'skew' = !state.switchSupported
    ? 'skew'
    : disabled ? 'readonly' : 'none'
  const switchTitle = switchReason === 'skew'
    ? t('chip.skew.hint')
    : switchReason === 'readonly' ? t('chip.readonly.hint') : undefined

  const openEditor = useCallback((cwd: string, text: string): void => {
    setOpenCwd(cwd)
    setDraft(text)
    setError(null)
  }, [])

  const closeEditor = useCallback((): void => {
    setOpenCwd(undefined)
    setDraft('')
    setError(null)
  }, [])

  const addWorkspace = (cwd: string): void => {
    setPickerOpen(false)
    setPending(previous => previous.some(row => row.cwd === cwd) ? previous : [...previous, { cwd }])
    openEditor(cwd, '')
  }

  const cancelWorkspace = (cwd: string): void => {
    setPending(previous => previous.filter(row => row.cwd !== cwd))
    closeEditor()
  }

  const saveRow = async (row: WorkspacePromptRow): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await save(row.cwd, draft)
      setPending(previous => previous.filter(item => item.cwd !== row.cwd))
      closeEditor()
      setFlashCwd(row.cwd)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  const clearRow = async (row: WorkspacePromptRow): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await clear(row.cwd)
      closeEditor()
      setFlashCwd(row.cwd)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  const arm = (cwd: string, next: boolean): void => {
    if (switchReason !== 'none' || toggleBusy !== null) return
    setToggleBusy(cwd)
    setToggleError(null)
    void toggle(cwd, next)
      .catch(() => { setToggleError(cwd) })
      .finally(() => { setToggleBusy(null) })
  }

  const toggleRow = (row: WorkspacePromptRow): void => {
    if (openCwd === row.cwd) closeEditor()
    else openEditor(row.cwd, row.text)
  }

  const menuItems: MenuEntry[] = addable.length === 0
    ? [{
        type: 'label',
        id: 'empty',
        text: workspaces.items.length === 0 ? t('settings.add.none') : t('settings.add.empty'),
      }]
    : [
        { type: 'label', id: 'heading', text: t('settings.add.header') },
        ...addable.map(workspace => ({
          id: workspace.path,
          label: workspaceItemLabel(workspace.title, workspace.path),
        })),
      ]

  const meta = !workspacesReady
    ? t('settings.add.loading')
    : workspaces.items.length === 0
      ? t('settings.count').replace('{count}', String(state.entries.length))
      : t('settings.countOf')
        .replace('{configured}', String(state.entries.length))
        .replace('{total}', String(workspaces.items.length))

  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('settings.title')}</h2>
      <p className={css.intro}>{t('settings.intro')}</p>

      {!state.switchSupported && (
        <p className={css.banner} role="status">{t('settings.skew')}</p>
      )}
      {state.switchSupported && !state.writable && !loading && (
        <p className={css.banner} role="status">{t('settings.readonly')}</p>
      )}

      <div className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('settings.card')}</h3>
          <div className={css.headActions}>
            <span className={css.cardMeta}>{meta}</span>
            <Menu
              open={pickerOpen}
              onClose={() => { setPickerOpen(false) }}
              onSelect={(id) => { addWorkspace(id) }}
              items={menuItems}
              portal
              anchor={(
                <Button
                  variant="primary"
                  size="sm"
                  icon={<IconPlusOutlineRegular size={14} />}
                  disabled={disabled || !workspacesReady || addable.length === 0}
                  onClick={() => { setPickerOpen(open => !open) }}
                >
                  {t('settings.add')}
                </Button>
              )}
            />
          </div>
        </div>

        <div className={css.list}>
          {orderedRows.length === 0 && (
            <p className={css.listHint}>{t('settings.emptyInline')}</p>
          )}

          {orderedRows.map(row => (
            <PromptRow
              key={row.cwd}
              row={row}
              name={nameFor(row.cwd)}
              open={openCwd === row.cwd}
              draft={openCwd === row.cwd ? draft : ''}
              busy={busy}
              disabled={disabled}
              switchBusy={toggleBusy !== null}
              switchReason={switchReason}
              switchTitle={switchTitle}
              switchError={toggleError === row.cwd}
              flash={flashCwd === row.cwd}
              error={openCwd === row.cwd ? error : null}
              t={t}
              onOpen={() => { toggleRow(row) }}
              onDraft={(text) => { setDraft(text); setError(null) }}
              onSave={() => { void saveRow(row) }}
              onClear={() => { void clearRow(row) }}
              onCancel={() => { cancelWorkspace(row.cwd) }}
              onSwitch={(next) => { arm(row.cwd, next) }}
            />
          ))}

          {orderedRows.length > 0 && addable.length > 0 && (
            <div className={css.divider} role="separator">
              <span className={css.dividerLabel}>{t('settings.divider')}</span>
              <span className={css.dividerCount}>{addable.length}</span>
            </div>
          )}

          {addable.map(workspace => (
            <EmptyRow
              key={workspace.path}
              name={workspace.title}
              cwd={workspace.path}
              flash={flashCwd === workspace.path}
              t={t}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
