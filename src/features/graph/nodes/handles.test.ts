import { describe, expect, it } from 'vitest'
import { BAND_SPAN, BAND_THICKNESS, handleBands, type HandleSize } from './handles'
import { NODE_SIZE } from '../factory'

/** Share of a card that is *not* covered by a connection band, so drags reach the node. */
function freeAreaRatio(size: HandleSize, card: { width: number; height: number }) {
  const thickness = BAND_THICKNESS[size]
  // Bands sit half in / half out of the border, so each eats thickness / 2 inside.
  const inside = thickness / 2
  const freeWidth = card.width - inside * 2
  const freeHeight = card.height - inside * 2
  if (freeWidth <= 0 || freeHeight <= 0) return 0
  return (freeWidth * freeHeight) / (card.width * card.height)
}

describe('handleBands', () => {
  it('exposes one band per side', () => {
    expect(handleBands('card').map((band) => band.id)).toEqual(['top', 'right', 'bottom', 'left'])
  })

  it('leaves the corners free so the resizer grips stay reachable', () => {
    expect(BAND_SPAN).toBeLessThan(100)
    const inset = `${(100 - BAND_SPAN) / 2}%`
    for (const band of handleBands('card')) {
      // Horizontal bands are inset along x, vertical ones along y.
      const horizontal = band.id === 'top' || band.id === 'bottom'
      expect(horizontal ? band.style.left : band.style.top).toBe(inset)
      expect(horizontal ? band.style.width : band.style.height).toBe(`${BAND_SPAN}%`)
    }
  })

  it('straddles the border rather than reaching into the card', () => {
    const thickness = BAND_THICKNESS.card
    const [top, right, bottom, left] = handleBands('card')
    expect(top!.style).toMatchObject({ top: -thickness / 2, height: thickness })
    expect(right!.style).toMatchObject({ right: -thickness / 2, width: thickness })
    expect(bottom!.style).toMatchObject({ bottom: -thickness / 2, height: thickness })
    expect(left!.style).toMatchObject({ left: -thickness / 2, width: thickness })
  })

  // Regression guard: bands used to be 42%/76% slabs that covered ~94% of a card,
  // so nearly every drag started a connection instead of moving the node.
  it('keeps most of a card draggable', () => {
    expect(freeAreaRatio('card', NODE_SIZE.item)).toBeGreaterThan(0.7)
    expect(freeAreaRatio('card', NODE_SIZE.note)).toBeGreaterThan(0.7)
  })

  it('keeps a chip draggable despite its small height', () => {
    expect(freeAreaRatio('chip', { width: 120, height: 30 })).toBeGreaterThan(0.5)
  })
})
