/** The one-time confirmation's pure parts: payload, answer reading, and session memory. */

import { describe, expect, it } from 'vitest'
import {
  CONFIRM_QUESTION_ID, INCLUDE_LABEL, SKIP_LABEL, SessionDecisions, confirmQuestions, readInclude,
} from '../src/confirm.ts'

describe('confirmQuestions', () => {
  it('asks one stable question offering exactly the include and skip answers', () => {
    const questions = confirmQuestions()
    expect(questions).toHaveLength(1)
    expect(questions[0]?.id).toBe(CONFIRM_QUESTION_ID)
    expect(questions[0]?.options?.map(option => option.label)).toEqual([INCLUDE_LABEL, SKIP_LABEL])
  })

  it('states that skipping covers the rest of the session and leaves the switch alone', () => {
    const skip = confirmQuestions()[0]?.options?.find(option => option.label === SKIP_LABEL)
    expect(skip?.description).toContain('本会话')
    expect(skip?.description).toContain('开关')
  })

  it('asks about the session, not one turn', () => {
    expect(confirmQuestions()[0]?.question).toContain('本次会话')
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

describe('SessionDecisions', () => {
  it('has no answer for a session that was never asked', () => {
    expect(new SessionDecisions().recall('agent-1')).toBeUndefined()
  })

  it('keeps one answer for the session, however many turns follow', () => {
    const decisions = new SessionDecisions()
    decisions.record('agent-1', false)
    expect(decisions.recall('agent-1')).toBe(false)
    expect(decisions.recall('agent-1')).toBe(false)
  })

  it('keeps sessions apart', () => {
    const decisions = new SessionDecisions()
    decisions.record('agent-1', false)
    expect(decisions.recall('agent-2')).toBeUndefined()
  })

  it('replaces an earlier verdict for the same session', () => {
    const decisions = new SessionDecisions()
    decisions.record('agent-1', true)
    decisions.record('agent-1', false)
    expect(decisions.recall('agent-1')).toBe(false)
  })
})
