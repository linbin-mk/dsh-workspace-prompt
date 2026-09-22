import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { workspacePromptModal } from './stores'
import { zh } from './locales'

/**
 * Frame-wide modal (registered into `shell.overlay`) that edits the prompt
 * configured for the workspace the current session runs in. Opened by the
 * `/workspace-prompt` slash command; saves and clears through the persist
 * handlers the command half registered on the shared observable.
 *
 * It reads its state from the module-level {@link workspacePromptModal}
 * observable via `useSyncExternalStore` — `shell.overlay` is a root-scoped
 * slot that does not deliver a per-entry `inject` face, so the modal cannot
 * receive data through slot props.
 */
export function WorkspacePromptModal(): JSX.Element | null {
  const state = useSyncExternalStore(workspacePromptModal.subscribe, workspacePromptModal.getSnapshot)
  const [draft, setDraft] = useState(state.value)
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(state.value)
    setError(null)
  }, [state.open, state.value])

  if (!state.open || state.cwd === undefined) return null
  const cwd = state.cwd

  const onSave = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await workspacePromptModal.handlers?.save(cwd, draft)
      workspacePromptModal.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const onClear = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await workspacePromptModal.handlers?.clear(cwd)
      workspacePromptModal.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => workspacePromptModal.close()}
      closeLabel="关闭"
      title={zh['modal.title']}
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={onClear}>{zh['modal.clear']}</Button>
          <Button variant="primary" disabled={busy} onClick={onSave}>{zh['modal.save']}</Button>
        </>
      )}
    >
      <div style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-2, #f2f4f7)',
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--dsw-alias-label-secondary, #475467)',
        fontFamily: 'var(--dsw-alias-font-mono, monospace)',
        wordBreak: 'break-all',
      }}>
        {zh['modal.cwd'].replace('{cwd}', cwd)}
      </div>
      <textarea
        value={draft}
        placeholder={zh['modal.placeholder']}
        disabled={busy}
        onFocus={() => { setFocused(true) }}
        onBlur={() => { setFocused(false) }}
        onChange={(event) => { setDraft(event.target.value) }}
        rows={8}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 10,
          padding: '8px 10px',
          border: `1px solid ${focused ? 'var(--dsw-alias-brand-primary, #4176e6)' : 'var(--dsw-alias-border-l2, #d0d5dd)'}`,
          borderRadius: 8,
          background: 'var(--dsw-alias-bg-layer-1, #ffffff)',
          color: 'var(--dsw-alias-label-primary, #101828)',
          fontSize: 13,
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
          boxShadow: focused ? '0 0 0 2px rgba(65, 118, 230, 0.18)' : undefined,
          opacity: busy ? 0.6 : 1,
        }}
      />
      {error !== null && (
        <div role="alert" style={{ color: 'var(--dsw-alias-state-error-primary, #c0392b)', marginTop: 8 }}>
          {zh['modal.error'].replace('{message}', error)}
        </div>
      )}
    </Modal>
  )
}
