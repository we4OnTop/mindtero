import { Handle, Position } from '@xyflow/react'
import type { CSSProperties } from 'react'

/**
 * Connection affordances shared by every card-like node:
 *
 * - `dot` handles sit exactly on the card border and are the visible grab hint.
 * - `zone` handles are large invisible overlays along each edge so a connection
 *   can be started from anywhere near the card boundary, not just the dot.
 */

type Side = { id: string; position: Position; zoneStyle: CSSProperties }

const SIDES: Side[] = [
  {
    id: 'top',
    position: Position.Top,
    // Explicit width/height (not opposing insets): React Flow's handle CSS sets
    // a 6px default size that beats insets, so a zone would shrink to min-width.
    zoneStyle: { left: '12%', top: '-8px', width: '76%', height: '42%', borderRadius: 12 },
  },
  {
    id: 'right',
    position: Position.Right,
    zoneStyle: { top: '12%', right: '-8px', width: '42%', height: '76%', borderRadius: 12 },
  },
  {
    id: 'bottom',
    position: Position.Bottom,
    zoneStyle: { left: '12%', bottom: '-8px', width: '76%', height: '42%', borderRadius: 12 },
  },
  {
    id: 'left',
    position: Position.Left,
    zoneStyle: { top: '12%', left: '-8px', width: '42%', height: '76%', borderRadius: 12 },
  },
]

/** A full-card invisible handle: connections start from any pixel of the card. */
export function BodyHandle() {
  return (
    <Handle
      id="body"
      type="source"
      position={Position.Top}
      className="!transform-none !border-transparent !bg-transparent !opacity-100 mindtero-handle-body"
      style={{ inset: 0, width: '100%', height: '100%', borderRadius: 14 }}
    />
  )
}

export function EdgeZones() {
  return (
    <>
      {SIDES.map((side) => (
        <Handle
          key={side.id}
          id={side.id}
          type="source"
          position={side.position}
          className="mindtero-handle-zone"
          style={side.zoneStyle}
        />
      ))}
      {SIDES.map((side) => (
        <Handle
          key={`${side.id}-dot`}
          id={side.id}
          type="source"
          position={side.position}
          className="mindtero-handle-dot"
        />
      ))}
    </>
  )
}

