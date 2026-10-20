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
 * Copy ships in one language per ask (see `language.ts`): the question carries
 * literal text, so the Host picks the web UI's language instead of stacking
 * both. The include option shows the prompt itself, so the human sees exactly
 * what would enter the context.
 *
 * Pure by construction: the question text, the answer reading, and the
 * per-session memory carry no Cordis runtime, so `index.ts` only wires them.
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { AskUserQuestionAnswer, AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions/types'
// The full request type (questions plus the answering scope) lives on the
// service entry, next to the `ctx.userQuestions` Context merge.
import type { AskUserQuestionRequest } from '@deepseek-ai/dsh-user-questions'
import type { UiLanguage } from './language.ts'

/**
 * Question id echoed in the answer. Stable: the answer is matched by id, so a
 * UI that reorders or renames options cannot silently link a stale answer to a
 * later question.
 */
export const CONFIRM_QUESTION_ID = 'workspace-prompt-include'

/** One language's question copy, including both option labels. */
export interface ConfirmCopy {
  /** Short heading above the question. */
  header: string
  /** The question the human answers. */
  question: string
  /** Label of the answer that injects the prompt. */
  include: string
  /** Label of the answer that leaves this session without the prompt. */
  skip: string
  /** One-line explanation under the skip label. */
  skipDescription: string
}

/**
 * Question copy, one entry per shipped language.
 *
 * The labels are answer values: `readInclude` compares selected labels against
 * every entry, so a session answered under either language reads back
 * correctly. The include option carries no fixed description; its description
 * is the configured prompt (see {@link confirmQuestions}).
 */
export const CONFIRM_COPY: Readonly<Record<UiLanguage, ConfirmCopy>> = {
  zh: {
    header: '工作区提示词',
    question: '本次会话是否带上该工作区的工作区提示词？',
    include: '带上',
    skip: '不带',
    skipDescription: '本会话不再询问、也不注入，开关状态不变。',
  },
  en: {
    header: 'Workspace prompt',
    question: 'Include this workspace\u2019s prompt in this session?',
    include: 'Include',
    skip: 'Skip',
    skipDescription: 'Skip it for the rest of this session; the switch stays on.',
  },
}

/** Every include label an answer may carry, across shipped languages. */
const INCLUDE_LABELS = new Set(Object.values(CONFIRM_COPY).map(copy => copy.include))

/** Every skip label an answer may carry, across shipped languages. */
const SKIP_LABELS = new Set(Object.values(CONFIRM_COPY).map(copy => copy.skip))

/**
 * The question payload.
 * @param language - the copy language chosen from the web UI preference.
 * @param prompt - the configured prompt shown on the include option.
 * @returns the single confirmation question.
 */
export function confirmQuestions(language: UiLanguage, prompt: string): AskUserQuestionItem[] {
  const copy = CONFIRM_COPY[language]
  const shown = prompt.trim()
  return [{
    id: CONFIRM_QUESTION_ID,
    header: copy.header,
    question: copy.question,
    options: [
      {
        label: copy.include,
        ...(shown === '' ? {} : { description: shown }),
      },
      {
        label: copy.skip,
        description: copy.skipDescription,
      },
    ],
  }]
}

/**
 * Build the full request for one turn.
 * @param agent - the session's live agent, so the question reaches its client.
 * @param signal - the turn's cancellation signal; cancelling the turn settles the question.
 * @param language - the copy language chosen from the web UI preference.
 * @param prompt - the configured prompt shown on the include option.
 * @returns the request to pass to `ctx.userQuestions.ask`.
 */
export function confirmRequest(
  agent: Agent,
  signal: AbortSignal,
  language: UiLanguage,
  prompt: string,
): AskUserQuestionRequest {
  return { questions: confirmQuestions(language, prompt), agent, signal }
}

/**
 * Read the human's decision out of one answer.
 *
 * Only an explicit skip skips: the switch is already on, so a custom answer, a
 * missing item, or an unrecognised selection keeps the standing intent and
 * injects. Labels of every shipped language are recognised, so the answer is
 * read correctly whatever copy language the question used. Dismissal is
 * decided by the caller from the rejection code, not here.
 * @param answer - the answered question set.
 * @returns true to inject this turn, false only for the explicit skip label.
 */
export function readInclude(answer: AskUserQuestionAnswer): boolean {
  const item = answer.answers.find(entry => entry.id === CONFIRM_QUESTION_ID)
  if (item === undefined) return true
  return !(item.selected.some(label => SKIP_LABELS.has(label))
    && !item.selected.some(label => INCLUDE_LABELS.has(label)))
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
