import { describe, expect, it } from 'vitest'
import { WorkspacePromptObservable, WorkspacePromptsObservable } from '../src/client/stores.ts'
import type { WorkspacePromptsView } from '../src/client/config.ts'

/** One config-form read the overview renders from. */
function view(overrides: Partial<WorkspacePromptsView> = {}): WorkspacePromptsView {
  return { status: 'ready', writable: true, prompts: {}, ...overrides }
}

function observableWith(read: () => WorkspacePromptsView): WorkspacePromptsObservable {
  const store = new WorkspacePromptsObservable()
  store.handlers = { view: read }
  return store
}

describe('WorkspacePromptsObservable', () => {
  it('loads entries, drops empty prompts, and orders by workspace directory', async () => {
    const store = observableWith(() => view({ prompts: { '/b': 'two', '/a': 'one', '/c': '' } }))
    await store.refresh()
    expect(store.getSnapshot()).toEqual({
      status: 'ready',
      writable: true,
      entries: [
        { cwd: '/a', text: 'one' },
        { cwd: '/b', text: 'two' },
      ],
    })
  })

  it('carries the config-form status and write permission the section disables on', async () => {
    const store = observableWith(() => view({ status: 'unavailable', writable: false }))
    await store.refresh()
    expect(store.getSnapshot()).toEqual({ status: 'unavailable', writable: false, entries: [] })
  })

  it('adopts a pushed snapshot without re-reading the form', () => {
    const store = observableWith(() => view({ prompts: { '/stale': 'stale' } }))
    store.adopt(view({ prompts: { '/a': 'one' } }))
    expect(store.getSnapshot()).toEqual({
      status: 'ready',
      writable: true,
      entries: [{ cwd: '/a', text: 'one' }],
    })
  })

  it('starts loading with nothing writable before the first read', () => {
    expect(new WorkspacePromptsObservable().getSnapshot()).toEqual({
      status: 'loading',
      writable: false,
      entries: [],
    })
  })

  it('is a no-op before the handlers are wired', async () => {
    const store = new WorkspacePromptsObservable()
    await store.refresh()
    expect(store.getSnapshot()).toEqual({ status: 'loading', writable: false, entries: [] })
  })

  it('notifies subscribers on every publication', async () => {
    const store = observableWith(() => view({}))
    let notified = 0
    const unsubscribe = store.subscribe(() => { notified += 1 })
    await store.refresh()
    store.adopt(view({ prompts: { '/a': 'one' } }))
    unsubscribe()
    store.adopt(view({}))
    expect(notified).toBe(2)
  })
})

describe('WorkspacePromptObservable', () => {
  it('opens with the stored value and keeps the write permission it was given', () => {
    const modal = new WorkspacePromptObservable()
    modal.setWritable(true)
    modal.open('/ws', 'stored text')
    expect(modal.getSnapshot()).toEqual({
      open: true,
      cwd: '/ws',
      value: 'stored text',
      writable: true,
    })
  })

  it('closes without dropping the editable state', () => {
    const modal = new WorkspacePromptObservable()
    modal.open('/ws', 'stored text')
    modal.close()
    expect(modal.getSnapshot()).toEqual({
      open: false,
      cwd: '/ws',
      value: 'stored text',
      writable: false,
    })
  })

  it('publishes a write-permission change to subscribers', () => {
    const modal = new WorkspacePromptObservable()
    let notified = 0
    modal.subscribe(() => { notified += 1 })
    modal.setWritable(true)
    modal.setWritable(true)
    expect(modal.getSnapshot().writable).toBe(true)
    expect(notified).toBe(1)
  })
})
