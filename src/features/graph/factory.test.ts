import { describe, expect, it } from 'vitest'
import { createTagFrame, frameBounds } from './factory'

describe('frameBounds', () => {
  it('wraps all nodes with padding', () => {
    const bounds = frameBounds([
      { x: 0, y: 0, width: 268, height: 132 },
      { x: 500, y: 300, width: 220, height: 120 },
    ])
    expect(bounds.position.x).toBeLessThanOrEqual(0)
    expect(bounds.width).toBeGreaterThanOrEqual(500)
    expect(bounds.height).toBeGreaterThanOrEqual(300)
  })

  it('falls back to a default size for unknown node dimensions', () => {
    const bounds = frameBounds([{ x: 10, y: 10 }])
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
  })
})

describe('createTagFrame', () => {
  it('creates a frame with the tag, a deterministic tag chip and context edges', () => {
    const group = createTagFrame(
      'agency',
      { position: { x: 0, y: 0 }, width: 400, height: 300 },
      ['item:ABC', 'note:1', 'frame:old'],
    )
    expect(group.frame.data.tag).toBe('agency')
    expect(group.frame.zIndex).toBe(-1)
    expect(group.tagNode.id).toBe('tag:agency')
    expect(group.edges.map((edge) => edge.target)).toEqual(['item:ABC', 'note:1'])
  })
})
