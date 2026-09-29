/** The per-turn confirmation's pure parts: payload, answer reading, and turn memory. */

import { describe, expect, it } from 'vitest'
import {
  CONFIRM_QUESTION_ID, INCLUDE_LABEL, SKIP_LABEL, TurnDecisions, confirmQuestions, readInclude,
} from '../src/confirm.ts'

describe('confirmQuestions', () => {
  it('asks one stable question offering exactly the include and skip answers', () => {
    const questions = confirmQuestions()
    expect(questions).toHaveLength(1)
    expect(questions[0]?.id).toBe(CONFIRM_QUESTION_ID)
    expect(questions[0]?.options?.map(option => option.label)).toEqual([INCLUDE_LABEL, SKIP_LABEL])
  })

  it('states that skipping leaves the switch alone', () => {
    const skip = confirmQuestions()[0]?.options?.find(option => option.label === SKIP_LABEL)
    expect(skip?.description).toContain('开关')
  })
})

describe('readInclude', () => {
  const answer = (selected: string[], custom?: string) => ({
    answers: [{ id: CONFIRM_QUESTION_ID, selected, ...(custom === undefined ? {} : { custom }) }],
  })

  it('injects only when the include answer stands alone or beside skip', () => {
    expect(readInclude(answer([INCLUDE_LABEL]))).toBe(true)
    expect(readInclude(answer([INCLUDE_LABEL, SKIP_LABEL]))).toBe(true)
  })

  it('skips for the explicit skip answer', () => {
    expect(readInclude(answer([SKIP_LABEL]))).toBe(false)
  })

  it('keeps the armed intent for anything the protocol did not spell out', () => {
    expect(readInclude({ answers: [] })).toBe(true)
    expect(readInclude(answer([]))).toBe(true)
    expect(readInclude(answer([], '随便'))).toBe(true)
    expect(readInclude(answer(['其他']))).toBe(true)
  })
})

describe('TurnDecisions', () => {
  it('has no answer for a turn that was never asked', () => {
    expect(new TurnDecisions().recall('agent-1', 1)).toBeUndefined()
  })

  it('reuses the answer on that turn’s later steps', () => {
    const decisions = new TurnDecisions()
    decisions.record('agent-1', 3, false)
    expect(decisions.recall('agent-1', 3)).toBe(false)
  })

  it('asks again on the next turn', () => {
    const decisions = new TurnDecisions()
    decisions.record('agent-1', 3, false)
    expect(decisions.recall('agent-1', 4)).toBeUndefined()
  })

  it('keeps sessions apart', () => {
    const decisions = new TurnDecisions()
    decisions.record('agent-1', 3, false)
    expect(decisions.recall('agent-2', 3)).toBeUndefined()
  })

  it('ignores a stale turn recorded after a newer one', () => {
    const decisions = new TurnDecisions()
    decisions.record('agent-1', 5, true)
    decisions.record('agent-1', 4, false)
    expect(decisions.recall('agent-1', 5)).toBe(true)
  })

  it('replaces an earlier verdict for the same turn', () => {
    const decisions = new TurnDecisions()
    decisions.record('agent-1', 5, true)
    decisions.record('agent-1', 5, false)
    expect(decisions.recall('agent-1', 5)).toBe(false)
  })
})
