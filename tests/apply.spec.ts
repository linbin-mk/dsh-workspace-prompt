import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'
import { buildMessage } from '../src/inject.ts'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/** A Cordis `ctx` stand-in that records the effect and the pre-step listener. */
function loadPlugin(): {
  preStep: (payload: unknown, next: () => Promise<unknown>) => Promise<unknown>
  scope: { get: () => { prompts: Record<string, string> } }
} {
  let effectCalls = 0
  let preStep: ((payload: unknown, next: () => Promise<unknown>) => Promise<unknown>) | undefined
  const scope = { get: () => ({ prompts: {} as Record<string, string> }) }
  const ctx = {
    effect: (fn: () => unknown) => {
      effectCalls += 1
      fn()
    },
    on: (_event: string, fn: (payload: unknown, next: () => Promise<unknown>) => Promise<unknown>) => {
      preStep = fn
    },
    settings: { register: () => scope },
  }
  apply(ctx as never)
  if (preStep === undefined) throw new Error('plugin did not register a pre-step listener')
  return { preStep, scope, ...{ effectCalls } } as never
}

function human(text: string, id = 'human'): UserMessage {
  return { id, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } } as UserMessage
}

function fakeAgent(
  cwd: string | undefined,
  nextStep: UserMessage[] = [],
  surface: { nodes: number[]; events: Array<{ type: string; data: UserMessage } | undefined> } = { nodes: [], events: [] },
): unknown {
  return {
    inbox: {
      nextStep,
      remove: () => {},
      prepend: () => {},
      replace: () => {},
    },
    session: {
      header: { cwd },
      surface,
      snapshotEvents: () => surface.events,
    },
  }
}

function decision(messages: UserMessage[], kind: 'enter' | 'reject' = 'enter'): { kind: string; messages: UserMessage[] } {
  return { kind, messages: [...messages] }
}

const signal = (): AbortSignal => new AbortController().signal

describe('apply', () => {
  it('registers exactly one settings namespace effect and a pre-step listener', () => {
    const loaded = loadPlugin() as unknown as { effectCalls: number; preStep: unknown }
    expect(loaded.effectCalls).toBe(1)
    expect(typeof loaded.preStep).toBe('function')
  })

  it('injects the cwd prompt as a plugin-sourced context message on step 1', async () => {
    const { preStep, scope } = loadPlugin()
    scope.get = () => ({ prompts: { '/ws': '回答问题要幽默风趣' } })
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], step: 1, signal: signal() },
      async () => decision([user]),
    )) as { kind: string; messages: UserMessage[] }

    expect(result.kind).toBe('enter')
    const injected = result.messages.find(message => message.source.kind === 'plugin')
    expect(injected).toBeDefined()
    expect(injected?.source).toEqual({ kind: 'plugin', plugin: 'workspace-prompt' })
    expect(injected?.content[0]).toMatchObject({ text: expect.stringContaining('回答问题要幽默风趣') })
    expect(result.messages.indexOf(injected!)).toBe(1)
  })

  it('does not inject when the decision is rejected', async () => {
    const { preStep, scope } = loadPlugin()
    scope.get = () => ({ prompts: { '/ws': 'x' } })
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [], step: 1, signal: signal() },
      async () => decision([], 'reject'),
    )) as { messages: UserMessage[] }

    expect(result.messages).toHaveLength(0)
  })

  it('injects nothing when the cwd has no configured prompt', async () => {
    const { preStep, scope } = loadPlugin()
    scope.get = () => ({ prompts: {} })
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user])
    expect(result.messages.some(message => message.source.kind === 'plugin')).toBe(false)
  })

  it('does not re-inject when the desired message is already in the decision', async () => {
    const { preStep, scope } = loadPlugin()
    scope.get = () => ({ prompts: { '/ws': 'x' } })
    const desired = buildMessage('x')
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws', [desired]), messages: [user], step: 2, signal: signal() },
      async () => decision([user, desired]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user, desired])
  })

  it('splices the prompt after the last claimed message on later steps', async () => {
    const { preStep, scope } = loadPlugin()
    scope.get = () => ({ prompts: { '/ws': 'x' } })
    const c1 = human('a', 'c1')
    const c2 = human('b', 'c2')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [c1, c2], step: 2, signal: signal() },
      async () => decision([c1, c2]),
    )) as { messages: UserMessage[] }

    expect(result.messages.map(message => message.id)).toEqual(['c1', 'c2', expect.any(String)])
    const injected = result.messages[2]
    expect(injected.source).toEqual({ kind: 'plugin', plugin: 'workspace-prompt' })
  })

  it('does not re-inject on later steps when the prompt already stands in the session', async () => {
    const { preStep, scope } = loadPlugin()
    scope.get = () => ({ prompts: { '/ws': 'x' } })
    const user = human('hi')
    const agent = fakeAgent('/ws', [], {
      nodes: [0],
      events: [{ type: 'user/message', data: buildMessage('x') }],
    })
    const result = (await preStep(
      { agent, messages: [user], step: 2, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user])
    expect(result.messages.some(message => message.source.kind === 'plugin')).toBe(false)
  })

  it('re-injects the latest prompt when the configured text changed', async () => {
    const { preStep, scope } = loadPlugin()
    scope.get = () => ({ prompts: { '/ws': '新的提示词' } })
    const user = human('hi')
    const agent = fakeAgent('/ws', [], {
      nodes: [0],
      events: [{ type: 'user/message', data: buildMessage('旧的提示词') }],
    })
    const result = (await preStep(
      { agent, messages: [user], step: 2, signal: signal() },
      async () => decision([user]),
    )) as { kind: string; messages: UserMessage[] }

    expect(result.kind).toBe('enter')
    const injected = result.messages.find(message => message.source.kind === 'plugin')
    expect(injected?.content[0]).toMatchObject({ text: expect.stringContaining('新的提示词') })
  })
})
