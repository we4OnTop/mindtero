import dagre from '@dagrejs/dagre'
import type { MindEdge, MindNode } from './types'
import { NODE_SIZE } from './factory'

export type LayoutDirection = 'TB' | 'LR'

export interface LayoutOptions {
  direction?: LayoutDirection
  /** Gap between nodes in the same rank. */
  nodeSpacing?: number
  /** Gap between ranks. */
  rankSpacing?: number
}

function measure(node: MindNode): { width: number; height: number } {
  const width = node.measured?.width ?? node.width ?? NODE_SIZE.item.width
  const height = node.measured?.height ?? node.height ?? NODE_SIZE.item.height
  return { width, height }
}

/**
 * Sugiyama-style layered layout. Frames are left where the user put them —
 * auto-layout should not fight a deliberate spatial grouping.
 */
export function layoutGraph(
  nodes: MindNode[],
  edges: MindEdge[],
  { direction = 'TB', nodeSpacing = 48, rankSpacing = 96 }: LayoutOptions = {},
): MindNode[] {
  const movable = nodes.filter((node) => node.type !== 'frame')
  if (movable.length === 0) return nodes

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: direction, nodesep: nodeSpacing, ranksep: rankSpacing, marginx: 40, marginy: 40 })

  for (const node of movable) {
    const { width, height } = measure(node)
    graph.setNode(node.id, { width, height })
  }

  const ids = new Set(movable.map((node) => node.id))
  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    if (node.type === 'frame') return node
    const positioned = graph.node(node.id)
    if (!positioned) return node
    const { width, height } = measure(node)
    // dagre positions node centres; React Flow positions top-left corners.
    return {
      ...node,
      position: { x: positioned.x - width / 2, y: positioned.y - height / 2 },
    }
  })
}

/**
 * Simple grid arrangement, useful when a board has no edges yet and dagre would
 * produce a single long row.
 */
export function layoutGrid(nodes: MindNode[], columns = 4, gap = 40): MindNode[] {
  let index = 0
  return nodes.map((node) => {
    if (node.type === 'frame') return node
    const { width, height } = measure(node)
    const column = index % columns
    const row = Math.floor(index / columns)
    index += 1
    return {
      ...node,
      position: { x: column * (width + gap), y: row * (height + gap) },
    }
  })
}
