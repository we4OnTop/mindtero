import { createEdge } from './factory'
import { useBoards } from './store'
import { defaultPeriod, publicationYear } from './timeline'
import type { MindEdge, MindNode } from './types'

/** Cards that can sit on a research timeline. */
export function canLinkToTimeline(node: MindNode | undefined): node is MindNode {
  return Boolean(node && node.type !== 'timeline' && node.type !== 'frame')
}

/**
 * Connects cards to a timeline, each with a starting period derived from its
 * publication year. Cards already on that timeline are skipped. Does not push an
 * undo step on its own — callers group it with whatever they just did.
 */
export function linkToTimeline(timelineId: string, cards: MindNode[]): number {
  const state = useBoards.getState()
  const board = state.activeBoardId ? state.boards[state.activeBoardId] : undefined
  if (!board) return 0
  const byId = new Map(board.nodes.map((node) => [node.id, node]))
  const linked = new Set(
    board.edges.flatMap((edge) =>
      edge.source === timelineId ? [edge.target] : edge.target === timelineId ? [edge.source] : [],
    ),
  )
  const edges: MindEdge[] = cards
    .filter((card) => canLinkToTimeline(card) && card.id !== timelineId && !linked.has(card.id))
    .map((card) => ({
      ...createEdge(timelineId, card.id, 'context'),
      data: { kind: 'context', period: defaultPeriod(publicationYear(card, byId)) },
    }))
  state.addEdges(edges)
  return edges.length
}
