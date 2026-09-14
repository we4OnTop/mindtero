import { Handle, Position } from '@xyflow/react'
import type { CSSProperties } from 'react'

/**
 * Connection affordances shared by every card-like node.
 *
 * Each side is a *single* handle: a thin invisible band that straddles the card
 * border, with the visible dot painted as its `::after`. Thinness is the whole
 * point — React Flow starts a connection on any pointerdown that lands on a
 * handle, so a handle that spreads across the card swallows the drags and
 * clicks meant for the node itself and the card stops being movable.
 *
 * The bands also stop short of the corners, which keeps `NodeResizer`'s grips
 * reachable.
 */

/** Chips are only a couple of dozen pixels tall, so they take a slimmer band. */
export type HandleSize = 'card' | 'chip'

/** Band thickness in px, straddling the border half in / half out. */
export const BAND_THICKNESS: Record<HandleSize, number> = { card: 18, chip: 10 }

/** Percentage of each border a band covers, centred. */
export const BAND_SPAN = 68

export interface HandleBand {
  id: 'top' | 'right' | 'bottom' | 'left'
  position: Position
  style: CSSProperties
}

/**
 * Geometry for the four bands. Kept pure and exported so the free (draggable)
 * area of a card can be asserted in tests rather than discovered by hand.
 */
export function handleBands(size: HandleSize): HandleBand[] {
  const thickness = BAND_THICKNESS[size]
  const offset = -thickness / 2
  const span = `${BAND_SPAN}%`
  const inset = `${(100 - BAND_SPAN) / 2}%`

  // Explicit width/height (not opposing insets): React Flow's handle CSS sets a
  // default size that beats insets, so a band would shrink to its min-width.
  return [
    { id: 'top', position: Position.Top, style: { left: inset, width: span, top: offset, height: thickness } },
    { id: 'right', position: Position.Right, style: { top: inset, height: span, right: offset, width: thickness } },
    { id: 'bottom', position: Position.Bottom, style: { left: inset, width: span, bottom: offset, height: thickness } },
    { id: 'left', position: Position.Left, style: { top: inset, height: span, left: offset, width: thickness } },
  ]
}

export function EdgeZones({ size = 'card' }: { size?: HandleSize }) {
  return (
    <>
      {handleBands(size).map((band) => (
        <Handle
          key={band.id}
          id={band.id}
          type="source"
          position={band.position}
          className="mindtero-handle"
          style={band.style}
        />
      ))}
    </>
  )
}
