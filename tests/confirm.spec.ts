/** The one-time confirmation's pure parts: payload, answer reading, and session memory. */

import { describe, expect, it } from 'vitest'
import {
  CONFIRM_COPY, CONFIRM_QUESTION_ID, SessionDecisions, confirmQuestions, readInclude,
} from '../src/confirm.ts'

const PROMPT = '本工作区规则：回答前先看 README。'

describe('confirmQuestions', () => {
  it('asks one stable question offering exactly the include and skip answers', () => {
    const questions = confirmQuestions('zh', PROMPT)
    expect(questions).toHaveLength(1)
    expect(questions[0]?.id).toBe(CONFIRM_QUESTION_ID)
    expect(questions[0]?.options?.map(option => option.label))
      .toEqual([CONFIRM_COPY.zh.include, CONFIRM_COPY.zh.skip])
  })

  it('shows the configured prompt on the include option instead of generic copy', () => {
    const include = confirmQuestions('zh', PROMPT)[0]?.options?.[0]
    expect(include?.description).toBe(PROMPT)
  })

  it('keeps the prompt verbatim apart from surrounding whitespace', () => {
    const prompt = 'line one\nline two\n'
    expect(confirmQuestions('en', prompt)[0]?.options?.[0]?.description).toBe('line one\nline two')
  })

  it('omits the description when there is no prompt to show', () => {
    expect(confirmQuestions('zh', '   ')[0]?.options?.[0]).not.toHaveProperty('description')
  })

  it('states that skipping covers the rest of the session and leaves the switch alone', () => {
    const skip = confirmQuestions('zh', PROMPT)[0]?.options?.[1]
    expect(skip?.description).toContain('本会话')
    expect(skip?.description).toContain('开关')
  })

  it('asks about the session, not one turn, in each shipped language', () => {
    expect(confirmQuestions('zh', PROMPT)[0]?.question).toContain('本次会话')
    expect(confirmQuestions('en', PROMPT)[0]?.question).toBe(CONFIRM_COPY.en.question)
  })

  it('never renders both languages at once', () => {
    for (const language of ['zh', 'en'] as const) {
      const question = confirmQuestions(language, PROMPT)[0]
      const rendered = JSON.stringify([question?.header, question?.question, question?.options])
      const other = language === 'zh' ? CONFIRM_COPY.en : CONFIRM_COPY.zh
      expect(rendered).not.toContain(other.header)
      expect(rendered).not.toContain(other.question)
    }
  })

  it('picks copy from the requested language alone', () => {
    const zh = confirmQuestions('zh', PROMPT)[0]
    const en = confirmQuestions('en', PROMPT)[0]
    expect(zh?.header).toBe(CONFIRM_COPY.zh.header)
    expect(en?.header).toBe(CONFIRM_COPY.en.header)
    expect(zh?.options?.[1]?.description).toBe(CONFIRM_COPY.zh.skipDescription)
    expect(en?.options?.[1]?.description).toBe(CONFIRM_COPY.en.skipDescription)
  })
})

describe('readInclude', () => {
  const answer = (selected: string[], custom?: string) => ({
    answers: [{ id: CONFIRM_QUESTION_ID, selected, ...(custom === undefined ? {} : { custom }) }],
  })

  it('injects only when the include answer stands alone or beside skip', () => {
    expect(readInclude(answer([CONFIRM_COPY.zh.include]))).toBe(true)
    expect(readInclude(answer([CONFIRM_COPY.zh.include, CONFIRM_COPY.zh.skip]))).toBe(true)
  })

  it('skips for the explicit skip answer', () => {
    expect(readInclude(answer([CONFIRM_COPY.zh.skip]))).toBe(false)
  })

  it('reads a skip answered under the English copy too', () => {
    expect(readInclude(answer([CONFIRM_COPY.en.skip]))).toBe(false)
    expect(readInclude(answer([CONFIRM_COPY.en.include, CONFIRM_COPY.en.skip]))).toBe(true)
    expect(readInclude(answer([CONFIRM_COPY.en.include]))).toBe(true)
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
