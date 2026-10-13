/**
 * Integration contract for the host half: a real Cordis application dispatches
 * `agent/pre-step` through `ctx.waterfall`, exactly as the agent loop does.
 *
 * The rest of the host suite drives `apply` through a hand-rolled `ctx`
 * stand-in, which cannot notice a change in Cordis's listener chaining. This
 * spec pins the two properties that only the real runtime exhibits: the plugin's
 * `ctx.on` listener participates in the waterfall, and the decision an inner
 * listener settled reaches it with its own marks intact (`startsRequestSeries`,
 * which the 0.2.x goal-round driver sets) while the prompt is folded in.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/** The session surface and inbox the injection reads, kept minimal on purpose. */
function fakeAgent(): unknown {
  return {
    id: 'agent-integration',
    inbox: {
      nextStep: [],
      remove: () => {},
      prepend: () => {},
      replace: () => {},
    },
    session: {
      header: { cwd: '/ws' },
      surface: { nodes: [], events: [] },
      snapshotEvents: () => [],
    },
  }
}

function human(text: string): UserMessage {
  return { id: 'human', role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } } as UserMessage
}

/** Boot the host half on a real Cordis app and dispatch one pre-step. */
async function dispatch(
  inner: (messages: UserMessage[]) => Promise<unknown> | unknown,
): Promise<{
  result: { kind: string; messages: UserMessage[]; startsRequestSeries?: true }
  configured: { auto?: boolean } | undefined
}> {
  const ctx = new Context()
  let configured: { auto?: boolean } | undefined
  ctx.provide('settings', {
    configure: (presentation: { auto?: boolean }) => {
      configured = presentation
      return () => {}
    },
  })
  apply(ctx as never, {
    prompts: { get: () => ({ '/ws': 'integration prompt' }) },
    enabled: { get: () => ({ '/ws': true }) },
  } as never)

  const user = human('hi')
  const result = await ctx.waterfall(
    'agent/pre-step',
    { agent: fakeAgent(), messages: [user], turn: 1, step: 1, signal: new AbortController().signal },
    async () => await inner([user]),
  ) as { kind: string; messages: UserMessage[]; startsRequestSeries?: true }
  return { result, configured }
}

describe('host half on a real Cordis app', () => {
  it('folds the prompt into the decision an inner listener settled', async () => {
    const { result, configured } = await dispatch(messages => ({ kind: 'enter', messages }))

    // `ctx.inject(['settings'])` resolves asynchronously through the real app.
    expect(configured).toEqual({ auto: false })
    expect(result.kind).toBe('enter')
    const injected = result.messages.filter(message => message.source.kind === 'workspace-prompt')
    expect(injected).toHaveLength(1)
    expect(result.messages[0]?.source.kind).toBe('user')
  })

  it('hands the settled decision marks back to the loop untouched', async () => {
    const { result } = await dispatch(messages => ({ kind: 'enter', messages, startsRequestSeries: true }))

    expect(result.messages.some(message => message.source.kind === 'workspace-prompt')).toBe(true)
    expect(result.startsRequestSeries).toBe(true)
  })
})
