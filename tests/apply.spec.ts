import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'
import { buildMessage } from '../src/inject.ts'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/** Everything one `apply` call published, for both host wiring and Config reads. */
interface LoadedPlugin {
  preStep: (payload: unknown, next: () => Promise<unknown>) => Promise<unknown>
  /** The live map the fake Config's volatile `prompts` reference resolves to. */
  prompts: Record<string, string>
  /** Automatic-page policies registered through `ctx.settings.configure`. */
  configured: Array<{ auto?: boolean }>
  /** Service names this plugin asked for through `ctx.inject`. */
  injected: string[]
  /** Whether an effect was registered through the child context. */
  childEffects: number
}

/**
 * A Cordis `ctx` stand-in that records the pre-step listener, the injected
 * services, and the settings presentation, plus the live prompt map behind the
 * Config reference the loader would pass to `apply`.
 */
function loadPlugin(): LoadedPlugin {
  const prompts: Record<string, string> = {}
  const configured: Array<{ auto?: boolean }> = []
  const injected: string[] = []
  let childEffects = 0
  let preStep: ((payload: unknown, next: () => Promise<unknown>) => Promise<unknown>) | undefined
  const ctx = {
    effect: (fn: () => unknown) => { fn() },
    on: (_event: string, fn: (payload: unknown, next: () => Promise<unknown>) => Promise<unknown>) => {
      preStep = fn
    },
    inject: (names: string[], callback: (child: unknown) => void) => {
      injected.push(...names)
      callback({
        effect: (fn: () => unknown) => { childEffects += 1; fn() },
        settings: {
          configure: (presentation: { auto?: boolean }) => {
            configured.push(presentation)
            return () => {}
          },
        },
      })
    },
    fiber: {},
  }
  apply(ctx as never, { prompts: { get: () => prompts } } as never)
  if (preStep === undefined) throw new Error('plugin did not register a pre-step listener')
  return { preStep, prompts, configured, injected, childEffects }
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
  it('registers a pre-step listener and suppresses the generated config page', () => {
    const loaded = loadPlugin()
    expect(typeof loaded.preStep).toBe('function')
    // The plugin ships its own settings page, so the Plugins list must not
    // also generate one from its Config.
    expect(loaded.injected).toEqual(['settings'])
    expect(loaded.configured).toEqual([{ auto: false }])
    expect(loaded.childEffects).toBe(1)
  })

  it('injects the cwd prompt as workspace-prompt context on step 1', async () => {
    const { preStep, prompts } = loadPlugin()
    prompts['/ws'] = '回答问题要幽默风趣'
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], step: 1, signal: signal() },
      async () => decision([user]),
    )) as { kind: string; messages: UserMessage[] }

    expect(result.kind).toBe('enter')
    const injected = result.messages.find(message => message.source.kind === 'workspace-prompt')
    expect(injected).toBeDefined()
    expect(injected?.source).toEqual({ kind: 'workspace-prompt', form: 'instructions' })
    expect(injected?.content[0]).toMatchObject({ text: expect.stringContaining('回答问题要幽默风趣') })
    expect(result.messages.indexOf(injected!)).toBe(1)
  })

  it('re-reads the live Config at every step, so a saved prompt applies at once', async () => {
    const { preStep, prompts } = loadPlugin()
    const user = human('hi')
    const first = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }
    expect(first.messages.some(message => message.source.kind === 'workspace-prompt')).toBe(false)

    prompts['/ws'] = '刚刚保存的提示词'
    const second = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], step: 2, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }
    const injected = second.messages.find(message => message.source.kind === 'workspace-prompt')
    expect(injected?.content[0]).toMatchObject({ text: expect.stringContaining('刚刚保存的提示词') })
  })

  it('does not inject when the decision is rejected', async () => {
    const { preStep, prompts } = loadPlugin()
    prompts['/ws'] = 'x'
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [], step: 1, signal: signal() },
      async () => decision([], 'reject'),
    )) as { messages: UserMessage[] }

    expect(result.messages).toHaveLength(0)
  })

  it('injects nothing when the cwd has no configured prompt', async () => {
    const { preStep } = loadPlugin()
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user])
    expect(result.messages.some(message => message.source.kind === 'workspace-prompt')).toBe(false)
  })

  it('does not re-inject when the desired message is already in the decision', async () => {
    const { preStep, prompts } = loadPlugin()
    prompts['/ws'] = 'x'
    const desired = buildMessage('x')
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws', [desired]), messages: [user], step: 2, signal: signal() },
      async () => decision([user, desired]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user, desired])
  })

  it('splices the prompt after the last claimed message on later steps', async () => {
    const { preStep, prompts } = loadPlugin()
    prompts['/ws'] = 'x'
    const c1 = human('a', 'c1')
    const c2 = human('b', 'c2')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [c1, c2], step: 2, signal: signal() },
      async () => decision([c1, c2]),
    )) as { messages: UserMessage[] }

    expect(result.messages.map(message => message.id)).toEqual(['c1', 'c2', expect.any(String)])
    const injected = result.messages[2]
    expect(injected.source).toEqual({ kind: 'workspace-prompt', form: 'instructions' })
  })

  it('does not re-inject on later steps when the prompt already stands in the session', async () => {
    const { preStep, prompts } = loadPlugin()
    prompts['/ws'] = 'x'
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
    expect(result.messages.some(message => message.source.kind === 'workspace-prompt')).toBe(false)
  })

  it('re-injects the latest prompt when the configured text changed', async () => {
    const { preStep, prompts } = loadPlugin()
    prompts['/ws'] = '新的提示词'
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
    const injected = result.messages.find(message => message.source.kind === 'workspace-prompt')
    expect(injected?.content[0]).toMatchObject({ text: expect.stringContaining('新的提示词') })
  })
})
