/**
 * One-time confirmation for one workspace's prompt (host half).
 *
 * The switch decides whether a workspace's prompt may be injected at all; this
 * module decides whether it enters *this session*. The question is asked once,
 * the first time the prompt would actually be injected: "include" injects it
 * for the session, "skip" leaves the session without it and the question is
 * never asked again there. It asks through the official `ctx.userQuestions`
 * seam — the same service approvals and plan review use — so the question
 * renders in the session it belongs to and the step waits for the answer.
 * Nothing here writes configuration: answering "skip" leaves the workspace's
 * switch exactly as it was.
 *
 * Pure by construction: the question text, the answer reading, and the
 * per-session memory carry no Cordis runtime, so `index.ts` only wires them.
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { AskUserQuestionAnswer, AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions/types'
// The full request type (questions plus the answering scope) lives on the
// service entry, next to the `ctx.userQuestions` Context merge.
import type { AskUserQuestionRequest } from '@deepseek-ai/dsh-user-questions'

/**
 * Question id echoed in the answer. Stable: the answer is matched by id, so a
 * UI that reorders or renames options cannot silently link a stale answer to a
 * later question.
 */
export const CONFIRM_QUESTION_ID = 'workspace-prompt-include'

/** Label of the answer that injects the prompt. */
export const INCLUDE_LABEL = '带上 Include'

/** Label of the answer that leaves this turn without the prompt. */
export const SKIP_LABEL = '不带 Skip'

/**
 * The question payload.
 *
 * Copy is bilingual because the question protocol carries literal text and the
 * answering UI renders the session's language: a host-originated question has
 * no dictionary channel of its own (`.agents`-style client localization covers
 * client copy only).
 * @returns the single confirmation question.
 */
export function confirmQuestions(): AskUserQuestionItem[] {
  return [{
    id: CONFIRM_QUESTION_ID,
    header: '工作区提示词 Workspace prompt',
    question: '本次会话是否带上该工作区的工作区提示词？Include the workspace prompt in this session?',
    options: [
      {
        label: INCLUDE_LABEL,
        description: '并入本会话的模型上下文。Fold it into this session\u2019s model context.',
      },
      {
        label: SKIP_LABEL,
        description: '本会话不再询问、也不注入，开关状态不变。Skip it for the rest of this session; the switch stays on.',
      },
    ],
  }]
}

/**
 * Build the full request for one turn.
 * @param agent - the session's live agent, so the question reaches its client.
 * @param signal - the turn's cancellation signal; cancelling the turn settles the question.
 * @returns the request to pass to `ctx.userQuestions.ask`.
 */
export function confirmRequest(agent: Agent, signal: AbortSignal): AskUserQuestionRequest {
  return { questions: confirmQuestions(), agent, signal }
}

/**
 * Read the human's decision out of one answer.
 *
 * Only an explicit skip skips: the switch is already on, so a custom answer, a
 * missing item, or an unrecognised selection keeps the standing intent and
 * injects. Dismissal is decided by the caller from the rejection code, not
 * here.
 * @param answer - the answered question set.
 * @returns true to inject this turn, false only for the explicit skip label.
 */
export function readInclude(answer: AskUserQuestionAnswer): boolean {
  const item = answer.answers.find(entry => entry.id === CONFIRM_QUESTION_ID)
  if (item === undefined) return true
  return !(item.selected.includes(SKIP_LABEL) && !item.selected.includes(INCLUDE_LABEL))
}

/**
 * The session's answer, remembered for the session's whole life: the question
 * is asked once, and a "skip" is never revisited. One boolean per live agent.
 */
export class SessionDecisions {
  private readonly decided = new Map<string, boolean>()

  /**
   * The answer this session already gave.
   * @param agentId - session agent identity.
   * @returns the recorded decision, or undefined when this session has not answered yet.
   */
  recall(agentId: string): boolean | undefined {
    return this.decided.get(agentId)
  }

  /**
   * Remember this session's answer.
   * @param agentId - session agent identity.
   * @param include - whether the prompt is welcome in this session.
   */
  record(agentId: string, include: boolean): void {
    this.decided.set(agentId, include)
  }
}
