import { describe, expect, it } from 'vitest'
import { mergePromptRows } from '../src/client/rows.ts'

const ENTRY = (cwd: string, text: string) => ({ cwd, text })
const PENDING = (cwd: string) => ({ cwd })

describe('mergePromptRows', () => {
  it('lists pending rows before persisted entries', () => {
    const rows = mergePromptRows(
      [ENTRY('/b', 'b'), ENTRY('/a', 'a')],
      [PENDING('/c')],
    )
    expect(rows).toEqual([
      { cwd: '/c', text: '', isNew: true },
      { cwd: '/b', text: 'b', isNew: false },
      { cwd: '/a', text: 'a', isNew: false },
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
    expect(rows).toEqual([{ cwd: '/a', text: 'saved text', isNew: false }])
    expect(rows.map(row => row.cwd)).toHaveLength(1)
  })

  it('keeps a fresh pending row while its directory is not persisted yet', () => {
    const rows = mergePromptRows([ENTRY('/a', 'a')], [PENDING('/a'), PENDING('/b')])
    expect(rows.map(row => row.cwd)).toEqual(['/b', '/a'])
    expect(rows[0]).toEqual({ cwd: '/b', text: '', isNew: true })
  })

  it('handles an empty persisted list', () => {
    expect(mergePromptRows([], [PENDING('/x')])).toEqual([{ cwd: '/x', text: '', isNew: true }])
  })

  it('handles an empty pending list', () => {
    expect(mergePromptRows([ENTRY('/x', 'x')], [])).toEqual([{ cwd: '/x', text: 'x', isNew: false }])
  })

  it('dedupes a pending directory against several persisted entries by identity', () => {
    const rows = mergePromptRows([ENTRY('/a', 'a')], [PENDING('/a'), PENDING('/a')])
    expect(rows).toEqual([{ cwd: '/a', text: 'a', isNew: false }])
    expect(new Set(rows.map(row => row.cwd)).size).toBe(rows.length)
  })
})
