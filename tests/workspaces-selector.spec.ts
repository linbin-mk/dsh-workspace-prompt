import { describe, expect, it } from 'vitest'
import { unconfiguredWorkspaces } from '../src/client/workspaces.ts'

const WORKSPACES = [
  { workspaceId: 'w-1', path: '/a/one', title: 'one' },
  { workspaceId: 'w-2', path: '/b/two', title: 'two' },
  { workspaceId: 'w-3', path: '/c/three', title: 'three' },
  { workspaceId: 'w-4', path: '/d/four', title: 'four' },
]

describe('unconfiguredWorkspaces', () => {
  it('keeps workspaces outside the excluded set', () => {
    const paths = unconfiguredWorkspaces(WORKSPACES, new Set(['/a/one', '/c/three']))
    expect(paths.map(item => item.path)).toEqual(['/d/four', '/b/two'])
  })

  it('sorts by title, breaking ties by path', () => {
    const paths = unconfiguredWorkspaces(
      [
        { workspaceId: 'x', path: '/z/zeta', title: 'zeta' },
        { workspaceId: 'y', path: '/a/alpha', title: 'alpha' },
        { workspaceId: 'z', path: '/z2/alpha-two', title: 'alpha' },
      ],
      new Set(),
    )
    expect(paths.map(item => item.path)).toEqual(['/a/alpha', '/z2/alpha-two', '/z/zeta'])
  })

  it('returns an empty list when every workspace is excluded', () => {
    const paths = unconfiguredWorkspaces(WORKSPACES, new Set(WORKSPACES.map(w => w.path)))
    expect(paths).toEqual([])
  })

  it('returns an empty list when no workspaces are registered', () => {
    expect(unconfiguredWorkspaces([], new Set())).toEqual([])
  })

  it('carries the workspace id through to the selected row', () => {
    const [first] = unconfiguredWorkspaces(WORKSPACES, new Set())
    expect(first?.workspaceId).toBe('w-4')
    expect(first?.title).toBe('four')
  })
})
