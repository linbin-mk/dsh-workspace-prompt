import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'
import { INCLUDE_LABEL, SKIP_LABEL } from '../src/confirm.ts'
import { buildMessage } from '../src/inject.ts'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/** Everything one `apply` call published, for both host wiring and Config reads. */
interface LoadedPlugin {
  preStep: (payload: unknown, next: () => Promise<unknown>) => Promise<unknown>
  /** The live map the fake Config's volatile `prompts` reference resolves to. */
  prompts: Record<string, string>
  /** The live map the fake Config's volatile `enabled` reference resolves to. */
  enabled: Record<string, boolean>
  /** Automatic-page policies registered through `ctx.settings.configure`. */
  configured: Array<{ auto?: boolean }>
  /** Service names this plugin asked for through `ctx.inject`. */
  injected: string[]
  /** Whether an effect was registered through the child context. */
  childEffects: number
  /** The recorded `userQuestions.ask` calls this plugin made. */
  asked: Array<{ id: string; agent: unknown; signal: unknown }>
}

/** Scripted answerer standing in for `ctx.userQuestions` (or its absence). */
interface FakeQuestions {
  /** Answer the next ask, or reject it with one of the service's error codes. */
  answer: 'include' | 'skip' | 'dismiss' | 'no-answerer' | 'delegated'
}

/**
 * A Cordis `ctx` stand-in that records the pre-step listener, the injected
 * services, and the settings presentation, plus the live prompt and arm maps
 * behind the Config references the loader would pass to `apply`.
 */
function loadPlugin(questions?: FakeQuestions): LoadedPlugin {
  const prompts: Record<string, string> = {}
  const enabled: Record<string, boolean> = {}
  const configured: Array<{ auto?: boolean }> = []
  const injected: string[] = []
  const asked: Array<{ id: string; agent: unknown; signal: unknown }> = []
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
    get: (name: string) => {
      if (name !== 'userQuestions' || questions === undefined) return undefined
      return {
        ask: async (request: { questions: readonly { id: string }[]; agent: unknown; signal: unknown }) => {
          for (const question of request.questions) {
            asked.push({ id: question.id, agent: request.agent, signal: request.signal })
          }
          if (questions.answer === 'no-answerer') throw Object.assign(new Error('no answerer'), { code: 'NO_PROVIDER' })
          if (questions.answer === 'delegated') throw Object.assign(new Error('delegated'), { code: 'DELEGATED_CALLER' })
          if (questions.answer === 'dismiss') throw Object.assign(new Error('dismissed'), { code: 'ASK_CANCELLED' })
          return {
            answers: [{
              id: 'workspace-prompt-include',
              selected: [questions.answer === 'skip' ? SKIP_LABEL : INCLUDE_LABEL],
            }],
          }
        },
      }
    },
  }
  apply(ctx as never, {
    prompts: { get: () => prompts },
    enabled: { get: () => enabled },
  } as never)
  if (preStep === undefined) throw new Error('plugin did not register a pre-step listener')
  return { preStep, prompts, enabled, configured, injected, childEffects, asked }
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
    id: 'agent-1',
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

/** Whether one step's decision carries this plugin's context message. */
function injectedMessages(result: { messages: UserMessage[] }): UserMessage[] {
  return result.messages.filter(message => message.source.kind === 'workspace-prompt')
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

  it('injects the armed cwd prompt as workspace-prompt context on step 1', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = '回答问题要幽默风趣'
    enabled['/ws'] = true
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { kind: string; messages: UserMessage[] }

    expect(result.kind).toBe('enter')
    const injected = result.messages.find(message => message.source.kind === 'workspace-prompt')
    expect(injected).toBeDefined()
    expect(injected?.source).toEqual({ kind: 'workspace-prompt', form: 'instructions' })
    expect(injected?.content[0]).toMatchObject({ text: expect.stringContaining('回答问题要幽默风趣') })
    expect(result.messages.indexOf(injected!)).toBe(1)
  })

  it('injects nothing while the configured prompt is not armed', async () => {
    const { preStep, prompts } = loadPlugin()
    prompts['/ws'] = '配置了但不注入'
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user])
    expect(injectedMessages(result)).toHaveLength(0)
  })

  it('stops injecting again once the workspace is disarmed', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const user = human('hi')
    await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )

    enabled['/ws'] = false
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 2, step: 2, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(injectedMessages(result)).toHaveLength(0)
  })

  it('arms a workspace mid-session, so the next step carries the prompt', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = '刚刚打开的开关'
    const user = human('hi')
    const first = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }
    expect(injectedMessages(first)).toHaveLength(0)

    enabled['/ws'] = true
    const second = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 2, step: 2, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }
    const injected = injectedMessages(second)
    expect(injected).toHaveLength(1)
    expect(injected[0]?.content[0]).toMatchObject({ text: expect.stringContaining('刚刚打开的开关') })
  })

  it('re-reads the live Config at every step, so a saved prompt applies at once', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    const user = human('hi')
    const first = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }
    expect(injectedMessages(first)).toHaveLength(0)

    prompts['/ws'] = '刚刚保存的提示词'
    enabled['/ws'] = true
    const second = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 2, step: 2, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }
    const injected = injectedMessages(second)
    expect(injected[0]?.content[0]).toMatchObject({ text: expect.stringContaining('刚刚保存的提示词') })
  })

  it('does not inject when the decision is rejected', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [], turn: 1, step: 1, signal: signal() },
      async () => decision([], 'reject'),
    )) as { messages: UserMessage[] }

    expect(result.messages).toHaveLength(0)
  })

  it('injects nothing when the cwd has no configured prompt', async () => {
    const { preStep } = loadPlugin()
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user])
    expect(injectedMessages(result)).toHaveLength(0)
  })

  it('stays disarmed for a workspace without an arm entry when another one is armed', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/armed'] = 'armed text'
    prompts['/quiet'] = 'quiet text'
    enabled['/armed'] = true
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/quiet'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(injectedMessages(result)).toHaveLength(0)
  })

  it('does not re-inject when the desired message is already in the decision', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const desired = buildMessage('x')
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws', [desired]), messages: [user], turn: 2, step: 2, signal: signal() },
      async () => decision([user, desired]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user, desired])
  })

  it('splices the prompt after the last claimed message on later steps', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const c1 = human('a', 'c1')
    const c2 = human('b', 'c2')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [c1, c2], turn: 2, step: 2, signal: signal() },
      async () => decision([c1, c2]),
    )) as { messages: UserMessage[] }

    expect(result.messages.map(message => message.id)).toEqual(['c1', 'c2', expect.any(String)])
    const injected = result.messages[2]
    expect(injected.source).toEqual({ kind: 'workspace-prompt', form: 'instructions' })
  })

  it('does not re-inject on later steps when the prompt already stands in the session', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const user = human('hi')
    const agent = fakeAgent('/ws', [], {
      nodes: [0],
      events: [{ type: 'user/message', data: buildMessage('x') }],
    })
    const result = (await preStep(
      { agent, messages: [user], turn: 2, step: 2, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(result.messages).toEqual([user])
    expect(injectedMessages(result)).toHaveLength(0)
  })

  it('re-injects the latest prompt when the configured text changed', async () => {
    const { preStep, prompts, enabled } = loadPlugin()
    prompts['/ws'] = '新的提示词'
    enabled['/ws'] = true
    const user = human('hi')
    const agent = fakeAgent('/ws', [], {
      nodes: [0],
      events: [{ type: 'user/message', data: buildMessage('旧的提示词') }],
    })
    const result = (await preStep(
      { agent, messages: [user], turn: 2, step: 2, signal: signal() },
      async () => decision([user]),
    )) as { kind: string; messages: UserMessage[] }

    expect(result.kind).toBe('enter')
    const injected = result.messages.find(message => message.source.kind === 'workspace-prompt')
    expect(injected?.content[0]).toMatchObject({ text: expect.stringContaining('新的提示词') })
  })

  it('asks this turn\'s human before injecting an armed prompt', async () => {
    const loaded = loadPlugin({ answer: 'include' })
    const { preStep, prompts, enabled } = loaded
    prompts['/ws'] = '受控注入'
    enabled['/ws'] = true
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(loaded.asked.map(call => call.id)).toEqual(['workspace-prompt-include'])
    expect(injectedMessages(result)).toHaveLength(1)
  })

  it('skips the turn on the skip answer and leaves the switch armed', async () => {
    const loaded = loadPlugin({ answer: 'skip' })
    const { preStep, prompts, enabled } = loaded
    prompts['/ws'] = '这轮不要'
    enabled['/ws'] = true
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(injectedMessages(result)).toHaveLength(0)
    expect(enabled['/ws']).toBe(true)
  })

  it('asks once per turn: later steps of the same turn reuse the answer', async () => {
    const loaded = loadPlugin({ answer: 'skip' })
    const { preStep, prompts, enabled } = loaded
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const user = human('hi')
    for (const step of [1, 2, 3]) {
      await preStep(
        { agent: fakeAgent('/ws'), messages: [user], turn: 4, step, signal: signal() },
        async () => decision([user]),
      )
    }

    expect(loaded.asked).toHaveLength(1)
  })

  it('asks again on the next turn, so a skip is not sticky', async () => {
    const loaded = loadPlugin({ answer: 'skip' })
    const { preStep, prompts, enabled } = loaded
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const user = human('hi')
    for (const turn of [1, 2]) {
      await preStep(
        { agent: fakeAgent('/ws'), messages: [user], turn, step: 1, signal: signal() },
        async () => decision([user]),
      )
    }

    expect(loaded.asked).toHaveLength(2)
  })

  it('keeps the armed prompt when nobody can answer (headless, owned agent)', async () => {
    for (const answer of ['no-answerer', 'delegated'] as const) {
      const loaded = loadPlugin({ answer })
      const { preStep, prompts, enabled } = loaded
      prompts['/ws'] = '无人可问时照常注入'
      enabled['/ws'] = true
      const user = human('hi')
      const result = (await preStep(
        { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
        async () => decision([user]),
      )) as { messages: UserMessage[] }

      expect(loaded.asked).toHaveLength(1)
      expect(injectedMessages(result)).toHaveLength(1)
    }
  })

  it('treats a dismissed question as a skip for that turn only', async () => {
    const loaded = loadPlugin({ answer: 'dismiss' })
    const { preStep, prompts, enabled } = loaded
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(injectedMessages(result)).toHaveLength(0)
    expect(enabled['/ws']).toBe(true)
  })

  it('never asks for a copy that already stands in the session', async () => {
    const loaded = loadPlugin({ answer: 'skip' })
    const { preStep, prompts, enabled } = loaded
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const user = human('hi')
    const agent = fakeAgent('/ws', [], {
      nodes: [0],
      events: [{ type: 'user/message', data: buildMessage('x') }],
    })
    await preStep(
      { agent, messages: [user], turn: 2, step: 2, signal: signal() },
      async () => decision([user]),
    )

    expect(loaded.asked).toHaveLength(0)
  })

  it('never asks while the workspace is not armed', async () => {
    const loaded = loadPlugin({ answer: 'include' })
    const { preStep, prompts } = loaded
    prompts['/ws'] = '配置了但没开'
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(loaded.asked).toHaveLength(0)
    expect(injectedMessages(result)).toHaveLength(0)
  })

  it('injects without asking when the profile composes no question channel', async () => {
    const loaded = loadPlugin()
    const { preStep, prompts, enabled } = loaded
    prompts['/ws'] = 'x'
    enabled['/ws'] = true
    const user = human('hi')
    const result = (await preStep(
      { agent: fakeAgent('/ws'), messages: [user], turn: 1, step: 1, signal: signal() },
      async () => decision([user]),
    )) as { messages: UserMessage[] }

    expect(injectedMessages(result)).toHaveLength(1)
  })
})
