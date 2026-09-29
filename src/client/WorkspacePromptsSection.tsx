/**
 * Settings overview page for the workspace-prompt plugin.
 *
 * Registered by the client plugin body as a `settings.section` contribution,
 * so it appears as its own navigation row inside the settings panel. It lists
 * every workspace with a configured prompt — read from the shared config form —
 * with in-place edit (Save) and removal (Clear) per row, plus an
 * **Add workspace** picker: workspaces without a prompt are offered in a
 * dropdown (from the live workspace list behind the `useWorkspaces` standard
 * hook), picking one opens a fresh editable row. The card list is derived in
 * one pass ({@link mergePromptRows}) — exactly one card per directory, so a
 * save's reload swaps the pending card for the persisted card atomically
 * instead of briefly rendering both. The page remounts on every visit (the
 * settings shell renders only the active section), so it always starts from a
 * fresh read of the shared form, and every write surface stays disabled while
 * the form is loading or the Host document refuses writes.
 */

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, IconPlusOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspacePromptsState } from './stores'
import { PromptToggleChip, type PromptTogglePhase, type PromptToggleReason } from './WorkspacePromptToggle'
import { mergePromptRows } from './rows'
import { unconfiguredWorkspaces, type WorkspaceForPicker } from './workspaces'

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

/** Shared card chrome (design tokens with neutral fallbacks). */
const card: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
  borderRadius: 8,
  padding: 14,
  marginTop: 12,
}

const title: CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--dsw-alias-label-primary, #101828)',
}

const hint: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-secondary, #475467)',
  marginTop: 4,
}

const pathText: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-secondary, #475467)',
  fontFamily: 'var(--dsw-alias-font-mono, monospace)',
  wordBreak: 'break-all',
}

const textareaBase: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 10,
  padding: '8px 10px',
  border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-1, #ffffff)',
  color: 'var(--dsw-alias-label-primary, #101828)',
  fontSize: 13,
  lineHeight: 1.6,
  resize: 'vertical',
  minHeight: 80,
  outline: 'none',
}

const newBadge: CSSProperties = {
  flexShrink: 0,
  fontSize: 11,
  lineHeight: 1,
  padding: '4px 8px',
  borderRadius: 999,
  color: 'var(--dsw-alias-brand-primary, #4176e6)',
  border: '1px solid var(--dsw-alias-brand-primary, #4176e6)',
}

/** Last path segment of an absolute directory (title fallback for rows whose workspace left the registry). */
function basenameOf(cwd: string): string {
  return cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? cwd
}

interface PromptCardProps {
  /** Absolute workspace directory (the persisted prompt key). */
  cwd: string
  /** Workspace display title. */
  name: string
  /** Persisted prompt text ('' for a fresh pending row). */
  text: string
  /** Whether this workspace's prompt is armed for injection. */
  enabled: boolean
  /** Fresh row picked from the Add menu (not persisted yet). */
  isNew: boolean
  /** Why this row's switch refuses interaction (global busy state included). */
  reason: PromptToggleReason
  t: TranslateNS<'workspace-prompt'>
  onSave: (cwd: string, text: string) => Promise<void>
  onClear: (cwd: string) => Promise<void>
  onToggle: (cwd: string, enabled: boolean) => Promise<void>
  onCancel: (cwd: string) => void
}

/** One workspace card: title + path, editable prompt, footer actions. */
function PromptCard({
  cwd, name, text, enabled, isNew, reason, t, onSave, onClear, onToggle, onCancel,
}: PromptCardProps): JSX.Element {
  const disabled = reason !== 'none'
  const [draft, setDraft] = useState(text)
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [armPhase, setArmPhase] = useState<PromptTogglePhase>('idle')

  // Follow the persisted value after a reload (post-save), while local edits win otherwise.
  useEffect(() => { setDraft(text) }, [text])

  // A refused arm write reports itself on the chip for a moment, then clears.
  useEffect(() => {
    if (armPhase !== 'failed') return
    const timer = setTimeout(() => { setArmPhase('idle') }, 2200)
    return () => { clearTimeout(timer) }
  }, [armPhase])

  const changed = draft !== text
  const saveEnabled = !disabled && !busy && draft.trim().length > 0 && (isNew || changed)

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await onSave(cwd, draft)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const clear = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await onClear(cwd)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const arm = (next: boolean): void => {
    setArmPhase('busy')
    void onToggle(cwd, next)
      .then(() => { setArmPhase('idle') })
      .catch(() => { setArmPhase('failed') })
  }

  return (
    <div style={{ ...card, borderColor: isNew ? 'var(--dsw-alias-brand-primary, #4176e6)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={title}>{name}</div>
          <div style={{ ...pathText, marginTop: 2 }}>{cwd}</div>
        </div>
        {/* A fresh row has nothing persisted to arm yet, so it carries no chip. */}
        {!isNew && (
          <PromptToggleChip
            enabled={enabled}
            reason={reason}
            phase={armPhase}
            labels={{
              labelOn: t('chip.label.on'),
              labelOff: t('chip.label.off'),
              onHint: t('chip.on.hint'),
              offHint: t('chip.off.hint'),
              readonlyHint: t('chip.readonly.hint'),
              failedHint: t('chip.failed.hint'),
              skewHint: t('chip.skew.hint'),
            }}
            onToggle={arm}
          />
        )}
        {isNew && <span style={newBadge}>{t('settings.new')}</span>}
      </div>
      <textarea
        value={draft}
        autoFocus={isNew}
        disabled={busy || disabled}
        placeholder={t('modal.placeholder')}
        onChange={(event) => { setDraft(event.target.value) }}
        onFocus={() => { setFocused(true) }}
        onBlur={() => { setFocused(false) }}
        rows={4}
        style={{
          ...textareaBase,
          borderColor: focused ? 'var(--dsw-alias-brand-primary, #4176e6)' : undefined,
          boxShadow: focused ? '0 0 0 2px rgba(65, 118, 230, 0.18)' : undefined,
          opacity: busy || disabled ? 0.6 : 1,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
        <span style={{ ...hint, marginTop: 0, flex: 1, minWidth: 0 }}>{t('settings.rowHint')}</span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {isNew
            ? (
              <Button variant="ghost" size="sm" disabled={busy || disabled} onClick={() => { onCancel(cwd) }}>
                {t('settings.cancel')}
              </Button>
            )
            : (
              <Button variant="outline" size="sm" disabled={busy || disabled} onClick={clear}>
                {t('settings.clear')}
              </Button>
            )}
          <Button variant="primary" size="sm" disabled={!saveEnabled} onClick={save}>
            {t('settings.save')}
          </Button>
        </div>
      </div>
      {error !== null && (
        <div role="alert" style={{ color: 'var(--dsw-alias-state-error-primary, #c0392b)', marginTop: 8, fontSize: 12 }}>
          {t('settings.error').replace('{message}', error)}
        </div>
      )}
    </div>
  )
}

/** Two-line menu row: workspace title over its canonical path. */
function workspaceItemLabel(name: string, path: string): ReactNode {
  return (
    <div style={{ minWidth: 0, maxWidth: 300 }}>
      <div style={{
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {name}
      </div>
      <div style={{
        fontSize: 11,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-secondary, #475467)',
        fontFamily: 'var(--dsw-alias-font-mono, monospace)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {path}
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
  const workspaces: { items: readonly WorkspaceForPicker[]; phase: string } = useWorkspaces(
    (value: { items: readonly WorkspaceForPicker[]; phase: string }) => value,
  )
  const [pending, setPending] = useState<readonly { cwd: string }[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // The section mounts on each visit to the settings page: start from a fresh read.
  useEffect(() => { void refresh() }, [refresh])

  // State hygiene for the picker's exclusion list: once a reload accounts a
  // pending row's prompt, drop it from the local list. Rendering dedupes
  // independently in `mergePromptRows`, so this effect never affects the
  // card list — only which directories stay out of the Add menu.
  useEffect(() => {
    setPending(previous => previous.filter(row => !state.entries.some(entry => entry.cwd === row.cwd)))
  }, [state.entries])

  const configuredPaths = useMemo<ReadonlySet<string>>(
    () => new Set(state.entries.map((entry: WorkspacePromptsState['entries'][number]) => entry.cwd)),
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
  const titleByPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const workspace of workspaces.items) map.set(workspace.path, workspace.title)
    return map
  }, [workspaces.items])

  const nameFor = (cwd: string): string => titleByPath.get(cwd) ?? basenameOf(cwd)

  // One card per directory: pending rows yield to their persisted entry as
  // soon as a reload accounts the saved prompt (same render, same React key —
  // no duplicate card, no reliance on the cleanup effect's timing).
  const rows = useMemo(
    () => mergePromptRows(state.entries, pending),
    [pending, state.entries],
  )

  const workspacesReady = workspaces.phase === 'ready'
  // The shared form has no Host answer yet: no row is trustworthy, and every
  // write surface stays disabled until it is ready and writable.
  const busy = state.status === 'loading'
  const disabled = busy || !state.writable
  // An upgraded browser half talking to a Host that has not been restarted
  // finds no arm field in the resolved section; saying so beats a refusal.
  const switchReason: PromptToggleReason = !state.switchSupported ? 'skew' : disabled ? 'readonly' : 'none'

  const addWorkspace = (cwd: string): void => {
    setPickerOpen(false)
    setPending(previous => previous.some(row => row.cwd === cwd) ? previous : [...previous, { cwd }])
  }

  const cancelWorkspace = (cwd: string): void => {
    setPending(previous => previous.filter(row => row.cwd !== cwd))
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

  return (
    <div>
      <h2>{t('settings.title')}</h2>
      <p>{t('settings.intro')}</p>
      {!state.switchSupported && <p role="status" style={{ ...hint, color: 'var(--dsw-alias-state-error-primary, #c0392b)' }}>{t('settings.skew')}</p>}

      {/* Toolbar: configured-count summary on the left, Add picker on the right. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
        <span style={{ ...hint, marginTop: 0 }}>
          {!workspacesReady
            ? t('settings.add.loading')
            : workspaces.items.length === 0
              ? t('settings.count').replace('{count}', String(state.entries.length))
              : t('settings.countOf')
                .replace('{configured}', String(state.entries.length))
                .replace('{total}', String(workspaces.items.length))}
        </span>
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
              disabled={disabled || !workspacesReady}
              onClick={() => { setPickerOpen(open => !open) }}
            >
              {t('settings.add')}
            </Button>
          )}
        />
      </div>

      {/* Configured + freshly added workspace cards. */}
      {rows.map(row => (
        <PromptCard
          key={row.cwd}
          cwd={row.cwd}
          name={nameFor(row.cwd)}
          text={row.text}
          enabled={row.enabled}
          isNew={row.isNew}
          reason={switchReason}
          t={t}
          onSave={save}
          onClear={clear}
          onToggle={toggle}
          onCancel={cancelWorkspace}
        />
      ))}

      {/* Empty state: nothing configured yet (Add lives in the toolbar above). */}
      {rows.length === 0 && !busy && (
        <div style={{ ...card, textAlign: 'center', padding: '22px 14px' }}>
          <div style={title}>{t('settings.empty.title')}</div>
          <div style={hint}>{t('settings.empty.hint')}</div>
        </div>
      )}
    </div>
  )
}
