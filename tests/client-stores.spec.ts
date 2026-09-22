import { describe, expect, it } from 'vitest'
import { WorkspacePromptsObservable } from '../src/client/stores.ts'

function observableWith(list: () => Promise<Record<string, string>>): WorkspacePromptsObservable {
  const store = new WorkspacePromptsObservable()
  store.handlers = { list }
  return store
}

describe('WorkspacePromptsObservable', () => {
  it('loads entries, drops empty prompts, and orders by workspace directory', async () => {
    const store = observableWith(async () => ({ '/b': 'two', '/a': 'one', '/c': '' }))
    await store.refresh()
    expect(store.getSnapshot()).toEqual({
      busy: false,
      error: null,
      entries: [
        { cwd: '/a', text: 'one' },
        { cwd: '/b', text: 'two' },
      ],
    })
  })

  it('records list failures as an error state', async () => {
    const store = observableWith(async () => { throw new Error('boom') })
    await store.refresh()
    const snapshot = store.getSnapshot()
    expect(snapshot.busy).toBe(false)
    expect(snapshot.error).toBe('boom')
    expect(snapshot.entries).toEqual([])
  })

  it('keeps existing entries when a later refresh fails', async () => {
    const store = observableWith(async () => ({ '/a': 'one' }))
    await store.refresh()
    store.handlers = { list: async () => { throw new Error('boom') } }
    await store.refresh()
    const snapshot = store.getSnapshot()
    expect(snapshot.error).toBe('boom')
    expect(snapshot.entries).toEqual([{ cwd: '/a', text: 'one' }])
  })

  it('is a no-op before the handlers are wired', async () => {
    const store = new WorkspacePromptsObservable()
    await store.refresh()
    expect(store.getSnapshot()).toEqual({ entries: [], busy: false, error: null })
  })

  it('notifies subscribers on refresh', async () => {
    const store = observableWith(async () => ({}))
    let notified = 0
    const unsubscribe = store.subscribe(() => { notified += 1 })
    await store.refresh()
    unsubscribe()
    expect(notified).toBeGreaterThan(0)
  })
})
