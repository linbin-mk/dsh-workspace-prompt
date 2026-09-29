import { describe, expect, it } from 'vitest'
import { mergePromptRows } from '../src/client/rows.ts'

const ENTRY = (cwd: string, text: string, enabled = false) => ({ cwd, text, enabled })
const PENDING = (cwd: string) => ({ cwd })

describe('mergePromptRows', () => {
  it('lists pending rows before persisted entries', () => {
    const rows = mergePromptRows(
      [ENTRY('/b', 'b'), ENTRY('/a', 'a')],
      [PENDING('/c')],
    )
    expect(rows).toEqual([
      { cwd: '/c', text: '', enabled: false, isNew: true },
      { cwd: '/b', text: 'b', enabled: false, isNew: false },
      { cwd: '/a', text: 'a', enabled: false, isNew: false },
    ])
  })

  it('never renders a pending row and its persisted entry for the same directory', () => {
    // The exact transition that used to show a duplicate card: the save's
    // reload accounts the pending directory while the pending row is still in
    // the local list.
    const rows = mergePromptRows(
      [ENTRY('/a', 'saved text')],
      [PENDING('/a')],
    )
    expect(rows).toEqual([{ cwd: '/a', text: 'saved text', enabled: false, isNew: false }])
    expect(rows.map(row => row.cwd)).toHaveLength(1)
  })

  it('keeps a fresh pending row while its directory is not persisted yet', () => {
    const rows = mergePromptRows([ENTRY('/a', 'a')], [PENDING('/a'), PENDING('/b')])
    expect(rows.map(row => row.cwd)).toEqual(['/b', '/a'])
    expect(rows[0]).toEqual({ cwd: '/b', text: '', enabled: false, isNew: true })
  })

  it('handles an empty persisted list', () => {
    expect(mergePromptRows([], [PENDING('/x')])).toEqual([{ cwd: '/x', text: '', enabled: false, isNew: true }])
  })

  it('carries the arm switch of a persisted entry onto its card', () => {
    expect(mergePromptRows([ENTRY('/a', 'a', true)], [])).toEqual([
      { cwd: '/a', text: 'a', enabled: true, isNew: false },
    ])
  })

  it('handles an empty pending list', () => {
    expect(mergePromptRows([ENTRY('/x', 'x')], [])).toEqual([{ cwd: '/x', text: 'x', enabled: false, isNew: false }])
  })

  it('dedupes a pending directory against several persisted entries by identity', () => {
    const rows = mergePromptRows([ENTRY('/a', 'a')], [PENDING('/a'), PENDING('/a')])
    expect(rows).toEqual([{ cwd: '/a', text: 'a', enabled: false, isNew: false }])
    expect(new Set(rows.map(row => row.cwd)).size).toBe(rows.length)
  })
})
