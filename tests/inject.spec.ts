import { describe, expect, it } from 'vitest'
import { buildMessage, renderPrompt, sameContent, surfaceSupplies, syncInbox, type InboxLike, type SurfaceLike } from '../src/inject.ts'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

function message(id: string, text: string, source: UserMessage['source'] = { kind: 'user' }): UserMessage {
  return { id, role: 'user', content: [{ type: 'text', text }], source } as UserMessage
}

/** A fake surface over a list of recorded events, keyed by their array index. */
function surfaceWith(
  events: Array<{ type: string; data: UserMessage } | undefined>,
  nodes: number[] = [],
): SurfaceLike {
  return { nodes, events } as unknown as SurfaceLike
}

/** A fake inbox that records every mutation so a test can assert on it. */
function inboxWith(messages: UserMessage[]): { inbox: InboxLike; ops: string[] } {
  const nextStep = [...messages]
  const ops: string[] = []
  const inbox: InboxLike = {
    get nextStep() {
      return nextStep
    },
    remove(id: string) {
      ops.push(`remove:${id}`)
      const index = nextStep.findIndex(candidate => candidate.id === id)
      if (index >= 0) nextStep.splice(index, 1)
    },
    prepend(_target: 'next-step', incoming: UserMessage) {
      ops.push(`prepend:${incoming.id}`)
      nextStep.unshift(incoming)
    },
    replace(id: string, incoming: UserMessage) {
      ops.push(`replace:${id}->${incoming.id}`)
      const index = nextStep.findIndex(candidate => candidate.id === id)
      if (index >= 0) nextStep[index] = incoming
    },
  }
  return { inbox, ops }
}

const isOurs = (owned: Set<string>) => (message: UserMessage): boolean => owned.has(message.id)

describe('renderPrompt', () => {
  it('wraps the raw prompt in a system-reminder with the standing-guidance intro', () => {
    expect(renderPrompt('回答要简洁')).toBe(
      '<system-reminder>\n'
      + 'The following workspace-specific prompt was configured by the user for this workspace. '
      + 'Treat it as standing guidance for work in this workspace; it does not override system, '
      + 'developer, or direct user instructions.\n\n回答要简洁\n</system-reminder>',
    )
  })

  it('keeps the prompt text verbatim between the intro and the closing tag', () => {
    const text = renderPrompt('a\nb')
    expect(text).toContain('a\nb')
    expect(text.endsWith('</system-reminder>')).toBe(true)
  })
})

describe('sameContent', () => {
  it('treats messages with identical content blocks as equal', () => {
    expect(sameContent(message('a', 'x'), message('b', 'x'))).toBe(true)
  })

  it('treats different content as unequal', () => {
    expect(sameContent(message('a', 'x'), message('a', 'y'))).toBe(false)
  })
})

describe('buildMessage', () => {
  it('marks the message as plugin-sourced context, not a human prompt', () => {
    const built = buildMessage('hi')
    expect(built.source).toEqual({ kind: 'plugin', plugin: 'workspace-prompt' })
  })

  it('embeds the rendered prompt as its single text block', () => {
    const built = buildMessage('hi')
    expect(built.content).toEqual([{ type: 'text', text: renderPrompt('hi') }])
  })

  it('mints a fresh id on every call', () => {
    expect(buildMessage('hi').id).not.toBe(buildMessage('hi').id)
  })

  it('freezes the complete message before publication', () => {
    const built = buildMessage('hi')
    expect(Object.isFrozen(built)).toBe(true)
    expect(Object.isFrozen(built.content)).toBe(true)
    expect(Object.isFrozen(built.content[0])).toBe(true)
    expect(Object.isFrozen(built.source)).toBe(true)
  })
})

describe('surfaceSupplies', () => {
  it('finds a previously injected copy among the surface events', () => {
    const desired = buildMessage('x')
    const surface = surfaceWith([{ type: 'user/message', data: desired }], [0])
    expect(surfaceSupplies(surface, buildMessage('x'))).toBe(true)
  })

  it('returns false for an empty surface', () => {
    expect(surfaceSupplies(surfaceWith([]), buildMessage('x'))).toBe(false)
  })

  it('ignores human messages with identical content', () => {
    const humanMessage = message('h', renderPrompt('x'), { kind: 'user' })
    const surface = surfaceWith([{ type: 'user/message', data: humanMessage }], [0])
    expect(surfaceSupplies(surface, buildMessage('x'))).toBe(false)
  })

  it('ignores non-message events and missing sequences', () => {
    const surface = surfaceWith(
      [{ type: 'step/start', data: message('s', '') }, undefined],
      [0, 5],
    )
    expect(surfaceSupplies(surface, buildMessage('x'))).toBe(false)
  })

  it('treats a changed payload as not supplied', () => {
    const surface = surfaceWith([{ type: 'user/message', data: buildMessage('old') }], [0])
    expect(surfaceSupplies(surface, buildMessage('new'))).toBe(false)
  })
})

describe('syncInbox', () => {
  it('clears every owned pending entry when there is nothing to inject', () => {
    const owned = new Set(['a', 'b'])
    const { inbox, ops } = inboxWith([message('a'), message('b')])
    syncInbox(inbox, [], isOurs(owned), undefined, undefined)
    expect(inbox.nextStep).toEqual([])
    expect(ops).toEqual(['remove:a', 'remove:b'])
  })

  it('clears owned pending entries when the desired message is already claimed', () => {
    const desired = message('d', 'x')
    const owned = new Set(['a'])
    const { inbox, ops } = inboxWith([message('a')])
    syncInbox(inbox, [desired], isOurs(owned), desired, undefined)
    expect(inbox.nextStep).toEqual([])
    expect(ops).toEqual(['remove:a'])
  })

  it('clears owned pending entries when the desired message already stands in the surface', () => {
    const desired = buildMessage('x')
    const owned = new Set(['a'])
    const { inbox, ops } = inboxWith([message('a')])
    const surface = surfaceWith([{ type: 'user/message', data: desired }], [0])
    syncInbox(inbox, [], isOurs(owned), desired, surface)
    expect(inbox.nextStep).toEqual([])
    expect(ops).toEqual(['remove:a'])
  })

  it('prepends the desired message when no owned entry is pending', () => {
    const desired = message('d', 'x')
    const { inbox, ops } = inboxWith([])
    syncInbox(inbox, [], isOurs(new Set()), desired, undefined)
    expect(inbox.nextStep).toEqual([desired])
    expect(ops).toEqual(['prepend:d'])
  })

  it('reuses an owned entry with matching content instead of replacing it', () => {
    const existing = message('a', 'x')
    const desired = message('d', 'x')
    const owned = new Set(['a'])
    const { inbox, ops } = inboxWith([existing])
    syncInbox(inbox, [], isOurs(owned), desired, undefined)
    expect(inbox.nextStep).toEqual([existing])
    expect(ops).toEqual([])
  })

  it('replaces the single owned entry when its content differs', () => {
    const existing = message('a', 'y')
    const desired = message('d', 'x')
    const owned = new Set(['a'])
    const { inbox, ops } = inboxWith([existing])
    syncInbox(inbox, [], isOurs(owned), desired, undefined)
    expect(inbox.nextStep).toEqual([desired])
    expect(ops).toEqual(['replace:a->d'])
  })

  it('keeps the reusable owned entry and removes the rest', () => {
    const a = message('a', 'x')
    const b = message('b', 'y')
    const desired = message('d', 'x')
    const owned = new Set(['a', 'b'])
    const { inbox, ops } = inboxWith([a, b])
    syncInbox(inbox, [], isOurs(owned), desired, undefined)
    expect(inbox.nextStep).toEqual([a])
    expect(ops).toEqual(['remove:b'])
  })

  it('replaces the first owned entry and removes the rest when none match', () => {
    const a = message('a', 'a')
    const b = message('b', 'b')
    const desired = message('d', 'x')
    const owned = new Set(['a', 'b'])
    const { inbox, ops } = inboxWith([a, b])
    syncInbox(inbox, [], isOurs(owned), desired, undefined)
    expect(inbox.nextStep).toEqual([desired])
    expect(ops).toEqual(['replace:a->d', 'remove:b'])
  })
})
