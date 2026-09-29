/**
 * Workspace-specific prompt plugin (host half).
 *
 * Persistence (feature 3): a per-workspace prompt is a live field of this
 * plugin's own Config — the volatile `prompts` map. The user-settings provider
 * persists the profile's user layer to its file in the Harness home, so the
 * content survives a Harness restart with no extra work here. The loader row
 * id (`workspace-prompt`) is the settings namespace, and the browser half
 * writes the same map through `ctx.configForms`.
 *
 * Injection (feature 2): the prompt enters the model context only while the
 * workspace's arm switch (`enabled`) is on — configuring a prompt never
 * injects it by itself. While armed, the prompt is folded in at session start
 * by mirroring the official `agent-instructions` mechanism — it is entered
 * exactly once, and later steps skip re-injection while an identical copy
 * still stands in the recorded session surface. It enters again only when the
 * configured text changes (or compaction drops the earlier copy). A durable
 * `user/message` carrying the prompt is managed in
 * the agent inbox at `agent/pre-step`, so it appears in the first model
 * request and is recorded in the session log. The source declares this
 * plugin's own kind with the `instructions` context form, which marks the
 * message as producer-supplied guidance rather than a human prompt: the Web
 * transcript projects every non-`user` source as a collapsed context row, and
 * host consumers that read human input (session titles, skill and mention
 * gestures, goal authority, wake budgets) skip it. The official
 * `agent-instructions` reconciliation only manages its own
 * `kind: 'agent-instructions'` messages, so it never disturbs this one.
 *
 * Keying: prompts are keyed by the session's absolute working directory
 * (`SessionHeader.cwd`), the stable identity of the workspace the session runs
 * in. The client resolves the same `cwd` for the current session.
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: the `ctx.settings` Context merge used for this instance's page policy.
import type {} from '@deepseek-ai/dsh-settings'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
// Type-only: the `userQuestions` Context merge for the optional question seam.
import type {} from '@deepseek-ai/dsh-user-questions'
import { confirmRequest, readInclude, TurnDecisions } from './confirm.ts'
import { buildMessage, enabledFor, promptFor, sameContent, surfaceSupplies, syncInbox, type InboxLike, type SurfaceLike } from './inject.ts'
import { ENABLED_FIELD, PROMPTS_FIELD } from './prompt-settings.ts'

export const name = 'workspace-prompt'

/** Live plugin configuration; both maps are re-read at every pre-step. */
export interface Config {
  /** Absolute workspace directory -> configured prompt text. */
  [PROMPTS_FIELD]: Volatile<Record<string, string>>
  /** Absolute workspace directory -> whether its prompt is armed for injection. */
  [ENABLED_FIELD]: Volatile<Record<string, boolean>>
}

/**
 * One prompts map as it crosses the settings boundary. The explicit schema type
 * keeps the emitted declaration of `Config` portable: an annotated `dict`
 * schema's inferred type would name cosmokit's `Dict`, which this package does
 * not import. `volatile()` below is what makes the field live.
 *
 * The field is declared `any` rather than `dict`: the browser half's shared
 * config form validates a section by calling its rehydrated schema, and the web
 * client's snapshot store deep-freezes every section it publishes. A `dict`
 * schema writes each resolved entry into that read-only map and throws
 * (`Cannot assign to read only property`), so the form treats the section as
 * invalid and keeps publishing its previous value — the settings page then
 * shows the pre-write map until it remounts. `any` passes the same value
 * through untouched. `promptFor` narrows the map before it is read, and the
 * settings write path still refuses paths outside a volatile field.
 */
const promptsField: z<Record<string, string>> = z.any().default({})

/** Live per-workspace arm switches; `any` for the same read-only-section reason as `promptsField`. */
const enabledField: z<Record<string, boolean>> = z.any().default({})

/** Live per-workspace prompts and their arm switches, the only fields the settings form edits. */
export const Config = z.object({
  [PROMPTS_FIELD]: promptsField.volatile(),
  [ENABLED_FIELD]: enabledField.volatile(),
})

interface PreStepPayload {
  agent: Agent
  messages: readonly UserMessage[]
  turn: number
  step: number
  signal: AbortSignal
}

export function apply(ctx: Context, config: Config): void {
  // This plugin owns its own settings page (`settings.section` in the client
  // half), so the Plugins list must not also generate one from this Config.
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })

  // Message ids this plugin has minted, used to recognise its own inbox entries.
  const ours = new Set<string>()

  // One answer per turn, reused by that turn's later steps.
  const decisions = new TurnDecisions()

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

  /**
   * Ask this turn's human whether the armed prompt should enter.
   *
   * Only the explicit skip label and an explicit dismissal skip: the workspace
   * is armed, so an unreadable answer keeps that standing intent. A missing
   * service, no answerer (headless runs), a non-root or owned agent, and an
   * aborted turn all fall back to injecting instead of blocking the turn on a
   * question nobody can answer.
   */
  const confirmTurn = async (agent: Agent, turn: number, signal: AbortSignal): Promise<boolean> => {
    const remembered = decisions.recall(agent.id, turn)
    if (remembered !== undefined) return remembered
    const questions = ctx.get('userQuestions')
    if (questions === undefined) return true
    let include = true
    try {
      include = readInclude(await questions.ask(confirmRequest(agent, signal)))
    } catch (error) {
      // A dismissal is an answer: this turn goes without the prompt, and the
      // switch stays armed for the next one.
      include = (error as { code?: unknown }).code !== 'ASK_CANCELLED'
    }
    decisions.record(agent.id, turn, include)
    return include
  }

  ctx.on('agent/pre-step', async (
    { agent, messages, turn, step, signal }: PreStepPayload,
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    const cwd = agent.session.header.cwd
    // The switch gates the prompt: an entry in `prompts` alone injects nothing.
    const text = cwd !== undefined && enabledFor(config.enabled.get(), cwd)
      ? promptFor(config.prompts.get(), cwd)
      : undefined
    let desired = text !== undefined && text.length > 0 ? buildMessage(text) : undefined

    if (decision.kind === 'reject' || (step === 1 && decision.messages.length === 0)) {
      // No model request proceeds: park the prompt as a pending inbox entry
      // so it is claimed with the next step. Its id is minted for recognition.
      if (desired !== undefined) ours.add(desired.id)
      syncInboxFor(agent, messages, desired)
      return decision
    }

    // The prompt enters only where it would actually be injected: a copy that
    // already stands in this turn's batch or in the recorded surface needs no
    // decision, so no question is asked for it.
    const pending = desired
    if (pending !== undefined
      && !surfaceSupplies(surfaceFor(agent), pending)
      && !decision.messages.some(message => sameContent(message, pending))
      && !await confirmTurn(agent, turn, signal)) {
      desired = undefined
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
