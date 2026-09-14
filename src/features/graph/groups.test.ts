import { describe, expect, it } from 'vitest'
import { frameMembership, groupEdges, hiddenAtLevel } from './groups'
import type { MindEdge, MindNode } from './types'

const frame = (id: string, x: number, y: number, width: number, height: number): MindNode => ({
  id,
  type: 'frame',
  position: { x, y },
  data: { label: id },
  width,
  height,
})

const note = (id: string, x: number, y: number): MindNode => ({
  id,
  type: 'note',
  position: { x, y },
  data: { text: id },
  width: 100,
  height: 50,
})

const edge = (source: string, target: string): MindEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  type: 'relation',
  data: { kind: 'supports' },
})

const nodes = [
  frame('outer', 0, 0, 1000, 1000),
  frame('inner', 100, 100, 300, 300),
  frame('other', 2000, 0, 400, 400),
  note('a', 150, 150),
  note('b', 600, 600),
  note('c', 2100, 100),
  note('loose', 5000, 5000),
]

describe('frameMembership', () => {
  it('assigns nodes to the smallest containing frame', () => {
    const membership = frameMembership(nodes)
    expect(membership.get('a')).toBe('inner')
    expect(membership.get('b')).toBe('outer')
    expect(membership.get('c')).toBe('other')
    expect(membership.has('loose')).toBe(false)
    expect(membership.has('inner')).toBe(false)
  })
})

describe('hiddenAtLevel', () => {
  const membership = frameMembership(nodes)
  it('shows only frames at the groups level', () => {
    expect([...hiddenAtLevel(nodes, 'groups', membership)].sort()).toEqual(['a', 'b', 'c', 'loose'])
  })
  it('hides loose nodes at the contents level', () => {
    expect([...hiddenAtLevel(nodes, 'contents', membership)]).toEqual(['loose'])
  })
  it('hides nothing at the all level', () => {
    expect(hiddenAtLevel(nodes, 'all', membership).size).toBe(0)
  })
})

describe('groupEdges', () => {
  it('summarises member connections between frames', () => {
    const membership = frameMembership(nodes)
    const frames = new Set(['outer', 'inner', 'other'])
    const summary = groupEdges(
      [edge('a', 'c'), edge('c', 'a'), edge('b', 'c'), edge('a', 'b'), edge('a', 'loose')],
      membership,
      frames,
    )
    expect(summary.map((entry) => [entry.source, entry.target, entry.data?.derived?.count])).toEqual([
      ['inner', 'other', 2],
      ['other', 'outer', 1],
      ['inner', 'outer', 1],
    ])
    expect(summary.every((entry) => entry.selectable === false && entry.deletable === false)).toBe(true)
  })
})
