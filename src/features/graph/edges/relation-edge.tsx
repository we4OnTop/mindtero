import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
  type EdgeTypes,
  type InternalNode,
} from '@xyflow/react'
import { memo, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { RELATIONS, RELATION_KINDS, relationSpec } from '../relations'
import { useBoards } from '../store'
import { EDGE_SHAPES, EDGE_SHAPE_LABELS, type EdgeShape, type MindEdge, type MindNode } from '../types'

export const markerId = (kind: string) => `mindtero-arrow-${kind}`

/**
 * Arrowheads live in a document-level <defs> so each relation can own a marker in
 * its exact colour; React Flow's built-in markers cannot read CSS variables.
 */
export function EdgeMarkerDefs() {
  return (
    <svg className="pointer-events-none absolute size-0" aria-hidden>
      <defs>
        {RELATION_KINDS.map((kind) => {
          const spec = RELATIONS[kind]
          if (spec.marker === 'none') return null
          return (
            <marker
              key={kind}
              id={markerId(kind)}
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
              markerUnits="strokeWidth"
            >
              {spec.marker === 'arrowclosed' ? (
                <path d="M 1 1 L 11 6 L 1 11 z" fill={spec.color} />
              ) : (
                <path
                  d="M 1 1 L 11 6 L 1 11"
                  fill="none"
                  stroke={spec.color}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </marker>
          )
        })}
      </defs>
    </svg>
  )
}

/**
 * Connections start from anywhere on a card, so the edge endpoint is computed
 * dynamically: the point on the source/target *card border* that faces the
 * other node. Handle coordinates only serve as a fallback until node sizes
 * are measured.
 */
function borderAnchor(
  node: InternalNode<MindNode> | undefined,
  fallbackX: number,
  fallbackY: number,
  otherX: number,
  otherY: number,
): { x: number; y: number; position: Position } {
  const width = node?.measured.width ?? node?.width
  const height = node?.measured.height ?? node?.height
  const origin = node?.internals.positionAbsolute
  if (!origin || !width || !height) {
    return { x: fallbackX, y: fallbackY, position: Position.Left }
  }

  const center = { x: origin.x + width / 2, y: origin.y + height / 2 }
  const dx = otherX - center.x
  const dy = otherY - center.y

  // Normalised so wide cards don't always pick top/bottom.
  const horizontal = Math.abs(dx) / (width / 2)
  const vertical = Math.abs(dy) / (height / 2)

  if (horizontal >= vertical) {
    const side = dx > 0 ? Position.Right : Position.Left
    return {
      x: dx > 0 ? origin.x + width : origin.x,
      y: Math.min(Math.max(otherY, origin.y + 14), origin.y + height - 14),
      position: side,
    }
  }
  const side = dy > 0 ? Position.Bottom : Position.Top
  return {
    x: Math.min(Math.max(otherX, origin.x + 18), origin.x + width - 18),
    y: dy > 0 ? origin.y + height : origin.y,
    position: side,
  }
}

function edgeCenter(
  node: InternalNode<MindNode> | undefined,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const width = node?.measured.width
  const height = node?.measured.height
  const origin = node?.internals.positionAbsolute
  if (!origin || !width || !height) return fallback
  return { x: origin.x + width / 2, y: origin.y + height / 2 }
}

/** Routing style from the edge data or the global default. */
export function resolveShape(shape: EdgeShape | undefined, fallback: EdgeShape): EdgeShape {
  return shape ?? fallback
}

/** SVG path for the chosen routing style; `bend` replaces the bezier midpoint. */
function buildPath(
  shape: EdgeShape,
  source: { x: number; y: number },
  sourcePosition: Position,
  target: { x: number; y: number },
  targetPosition: Position,
  bend?: { x: number; y: number },
): [string, number, number] {
  if (bend) {
    const path =
      shape === 'straight'
        ? `M ${source.x} ${source.y} L ${bend.x} ${bend.y} L ${target.x} ${target.y}`
        : `M ${source.x} ${source.y} C ${source.x + (bend.x - source.x) * 0.6} ${source.y + (bend.y - source.y) * 0.6}, ${target.x + (bend.x - target.x) * 0.6} ${target.y + (bend.y - target.y) * 0.6}, ${target.x} ${target.y}`
    return [path, bend.x, bend.y]
  }

  switch (shape) {
    case 'straight': {
      const [path, labelX, labelY] = getStraightPath({ sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y })
      return [path, labelX, labelY]
    }
    case 'step':
    case 'smoothstep': {
      const [path, labelX, labelY] = getSmoothStepPath({
        sourceX: source.x,
        sourceY: source.y,
        sourcePosition,
        targetX: target.x,
        targetY: target.y,
        targetPosition,
        borderRadius: shape === 'step' ? 0 : 12,
      })
      return [path, labelX, labelY]
    }
    default: {
      const [path, labelX, labelY] = getBezierPath({
        sourceX: source.x,
        sourceY: source.y,
        sourcePosition,
        targetX: target.x,
        targetY: target.y,
        targetPosition,
      })
      return [path, labelX, labelY]
    }
  }
}

function RelationEdgeComponent({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<MindEdge>) {
  const sourceNode = useInternalNode<MindNode>(source)
  const targetNode = useInternalNode<MindNode>(target)

  const sourceCenter = edgeCenter(sourceNode, { x: sourceX, y: sourceY })
  const targetCenter = edgeCenter(targetNode, { x: targetX, y: targetY })

  const sourceAnchor = borderAnchor(sourceNode, sourceX, sourceY, targetCenter.x, targetCenter.y)
  const targetAnchor = borderAnchor(targetNode, targetX, targetY, sourceCenter.x, sourceCenter.y)

  const spec = relationSpec(data?.kind)
  const updateEdgeData = useBoards((state) => state.updateEdgeData)
  const removeEdges = useBoards((state) => state.removeEdges)
  const globalShape = useSettings((state) => state.edgeShape)
  const viewOnly = useSettings((state) => state.viewOnly)
  const { screenToFlowPosition } = useReactFlow<MindNode, MindEdge>()
  const commit = useBoards((state) => state.commit)
  const [dragging, setDragging] = useState(false)

  const shape = resolveShape(data?.shape, globalShape)
  const [path, labelX, labelY] = buildPath(
    shape,
    sourceAnchor,
    sourceAnchor.position,
    targetAnchor,
    targetAnchor.position,
    data?.bend,
  )

  // Untyped "related" edges stay unlabelled to keep dense boards readable; selecting
  // one reveals the chip so its type can still be changed.
  const label = data?.label ?? (spec.kind === 'related' ? '' : spec.label)
  const showLabel = Boolean(label) || selected

  const onBendPointerDown = (event: React.PointerEvent) => {
    if (viewOnly) return
    event.preventDefault()
    event.stopPropagation()
    commit()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onBendPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return
    event.preventDefault()
    updateEdgeData(id, { bend: screenToFlowPosition({ x: event.clientX, y: event.clientY }) })
  }

  const onBendPointerUp = (event: React.PointerEvent) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDragging(false)
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={spec.marker === 'none' ? undefined : `url(#${markerId(spec.kind)})`}
        style={{
          stroke: spec.color,
          strokeWidth: selected ? spec.strokeWidth + 1 : spec.strokeWidth,
          strokeDasharray: spec.dash || undefined,
        }}
      />

      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center gap-1"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'bg-background/90 text-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur',
                    'hover:bg-accent cursor-pointer transition-colors',
                    selected && 'ring-primary/60 ring-2',
                  )}
                  style={{ borderColor: spec.color }}
                >
                  {label || spec.label}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>Relation type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {RELATION_KINDS.map((kind) => (
                  <DropdownMenuItem
                    key={kind}
                    onSelect={() => updateEdgeData(id, { kind, label: undefined })}
                  >
                    <span
                      className="h-0.5 w-4 rounded-full"
                      style={{ background: RELATIONS[kind].color }}
                      aria-hidden
                    />
                    {RELATIONS[kind].label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Line style</DropdownMenuLabel>
                {EDGE_SHAPES.map((shapeOption) => (
                  <DropdownMenuItem
                    key={shapeOption}
                    onSelect={() => updateEdgeData(id, { shape: shapeOption })}
                  >
                    {EDGE_SHAPE_LABELS[shapeOption]}
                    {shape === shapeOption && ' ✓'}
                  </DropdownMenuItem>
                ))}
                {data?.bend && (
                  <DropdownMenuItem onSelect={() => updateEdgeData(id, { bend: undefined })}>
                    Reset drag point
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={viewOnly}
                  onSelect={() => removeEdges([id])}
                >
                  Delete connection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Draggable midpoint: pull this dot to route the line by hand. */}
            {selected && !viewOnly && (
              <span
                role="slider"
                aria-label="Drag to bend the connection"
                onPointerDown={onBendPointerDown}
                onPointerMove={onBendPointerMove}
                onPointerUp={onBendPointerUp}
                className={cn(
                  'bg-primary nodrag nopan block size-4 cursor-grab rounded-full border-2 border-background shadow',
                  dragging && 'cursor-grabbing',
                )}
              />
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const RelationEdgeView = memo(RelationEdgeComponent)

export const edgeTypes = { relation: RelationEdgeView } satisfies EdgeTypes
