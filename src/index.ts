/**
 * Workspace-specific prompt plugin (host half).
 *
 * Persistence (feature 3): a per-workspace prompt is stored in the
 * user-settings document under the `workspace-prompt` namespace, which the
 * settings provider persists to a file in the Harness home — so the content
 * survives a Harness restart with no extra work here.
 *
 * Injection (feature 2): the prompt is folded into the model context at
 * session start by mirroring the official `agent-instructions` mechanism — it
 * is entered exactly once, and later steps skip re-injection while an
 * identical copy still stands in the recorded session surface. It enters
 * again only when the configured text changes (or compaction drops the
 * earlier copy). A durable `user/message` carrying the prompt is managed in
 * the agent inbox at `agent/pre-step`, so it appears in the first model
 * request and is recorded in the session log. The source is `kind: 'plugin'`,
 * which marks the message as producer-supplied context rather than a human
 * prompt: the Web transcript projects every non-`user` source as a collapsed
 * context row, and host consumers that read human input (session titles,
 * skill and mention gestures, goal authority, wake budgets) skip it. The
 * official `agent-instructions` reconciliation only manages its own
 * `kind: 'agent-instructions'` messages, so it never disturbs this one.
 *
 * Keying: prompts are keyed by the session's absolute working directory
 * (`SessionHeader.cwd`), the stable identity of the workspace the session runs
 * in. The client resolves the same `cwd` for the current session.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SettingsNamespace, SettingsScope } from '@deepseek-ai/dsh-settings'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { buildMessage, sameContent, surfaceSupplies, syncInbox, type InboxLike, type SurfaceLike } from './inject.ts'

export const name = 'workspace-prompt'

export const inject = ['settings']

const NS = 'workspace-prompt' as SettingsNamespace

interface PromptConfig {
  /** Absolute workspace directory -> configured prompt text. */
  prompts: Record<string, string>
}

interface PreStepPayload {
  agent: Agent
  messages: readonly UserMessage[]
  step: number
  signal: AbortSignal
}

export function apply(ctx: Context): void {
  let scope: SettingsScope<PromptConfig> | undefined
  ctx.effect(() => {
    const registered: SettingsScope<PromptConfig> = ctx.settings.register(NS, z.object({
      prompts: z.dict(z.string()).default({}),
    }), { base: { prompts: {} } })
    scope = registered
    return () => { scope = undefined }
  }, 'workspace-prompt: settings namespace')

  // Message ids this plugin has minted, used to recognise its own inbox entries.
  const ours = new Set<string>()

  const isOurs = (message: UserMessage): boolean => ours.has(message.id)

  /** The recorded session surface, read to detect previously injected copies. */
  const surfaceFor = (agent: Agent): SurfaceLike => ({
    nodes: agent.session.surface.nodes,
    events: agent.session.snapshotEvents(),
  })

  const syncInboxFor = (
    agent: Agent,
    claimed: readonly UserMessage[],
    desired: UserMessage | undefined,
  ): void => syncInbox(agent.inbox as InboxLike, claimed, isOurs, desired, surfaceFor(agent))

  ctx.on('agent/pre-step', async (
    { agent, messages, step, signal }: PreStepPayload,
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    void signal
    const cwd = agent.session.header.cwd
    const text = scope !== undefined && cwd !== undefined ? scope.get().prompts[cwd] : undefined
    const desired = text !== undefined && text.length > 0 ? buildMessage(text) : undefined

    if (decision.kind === 'reject' || (step === 1 && decision.messages.length === 0)) {
      // No model request proceeds: park the prompt as a pending inbox entry
      // so it is claimed with the next step. Its id is minted for recognition.
      if (desired !== undefined) ours.add(desired.id)
      syncInboxFor(agent, messages, desired)
      return decision
    }

    // A proceeding step settles the pending context: it either enters below
    // as `desired`, or its payload is already covered, so nothing stays pending.
    for (const message of agent.inbox.nextStep.filter(isOurs)) {
      ours.delete(message.id)
      agent.inbox.remove(message.id)
    }
    if (desired === undefined) return decision

    // The prompt is injected once, at session start. While an identical copy
    // still stands in the recorded surface — or in this step's batch — there
    // is nothing to do; only a changed payload enters again with the latest.
    if (surfaceSupplies(surfaceFor(agent), desired)
      || decision.messages.some(message => sameContent(message, desired))) {
      return decision
    }

    const lastClaimedIndex = decision.messages.findLastIndex(message => messages.includes(message))
    const entered = decision.messages.toSpliced(lastClaimedIndex + 1, 0, desired)
    return { kind: 'enter', messages: entered }
  })
}

// Re-export the Session type so consumers importing the host half need not
// reach the harness session package directly for the inbox keying contract.
export type { Session }
