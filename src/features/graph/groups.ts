import type { MindEdge, MindNode } from './types'

/**
 * Frames are visual groups, not React Flow parents, so membership is geometric:
 * a node belongs to the smallest frame that contains its centre. Everything here
 * is derived on the fly and never written to a board.
 */

export const DETAIL_LEVELS = ['groups', 'contents', 'all'] as const
export type DetailLevel = (typeof DETAIL_LEVELS)[number]

export const DETAIL_LABELS: Record<DetailLevel, string> = {
  groups: 'Groups',
  contents: 'Group contents',
  all: 'Everything',
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Best known size: measured by React Flow, then explicit, then style, then a fallback. */
export function nodeRect(node: MindNode, fallback = { width: 240, height: 120 }): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: numeric(node.measured?.width) ?? numeric(node.width) ?? numeric(node.style?.width) ?? fallback.width,
    height:
      numeric(node.measured?.height) ?? numeric(node.height) ?? numeric(node.style?.height) ?? fallback.height,
  }
}

/** Node id → id of the frame it sits in. Frames themselves are never members. */
export function frameMembership(nodes: MindNode[]): Map<string, string> {
  const frames = nodes
    .filter((node) => node.type === 'frame')
    .map((frame) => ({ id: frame.id, rect: nodeRect(frame) }))
    .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)

  const membership = new Map<string, string>()
  if (frames.length === 0) return membership
  for (const node of nodes) {
    if (node.type === 'frame') continue
    const rect = nodeRect(node)
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const home = frames.find(
      ({ rect: frame }) =>
        cx >= frame.x && cx <= frame.x + frame.width && cy >= frame.y && cy <= frame.y + frame.height,
    )
    if (home) membership.set(node.id, home.id)
  }
  return membership
}

/** Which nodes are hidden at a detail level. */
export function hiddenAtLevel(nodes: MindNode[], level: DetailLevel, membership: Map<string, string>): Set<string> {
  const hidden = new Set<string>()
  if (level === 'all') return hidden
  for (const node of nodes) {
    if (node.type === 'frame') continue
    if (level === 'groups' || !membership.has(node.id)) hidden.add(node.id)
  }
  return hidden
}

/**
 * One thick edge per pair of frames whose members are connected, carrying the
 * number of underlying connections. Edges inside a single frame are dropped.
 */
export function groupEdges(edges: MindEdge[], membership: Map<string, string>, frameIds: Set<string>): MindEdge[] {
  const groupOf = (id: string) => (frameIds.has(id) ? id : membership.get(id))
  const counts = new Map<string, { source: string; target: string; count: number }>()
  for (const edge of edges) {
    if (edge.data?.derived) continue
    const source = groupOf(edge.source)
    const target = groupOf(edge.target)
    if (!source || !target || source === target) continue
    // Direction does not matter for a summary: A↔B is one link.
    const [a, b] = source < target ? [source, target] : [target, source]
    const key = `${a}|${b}`
    const entry = counts.get(key) ?? { source: a, target: b, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }
  return [...counts.values()].map(({ source, target, count }) => ({
    id: `group:${source}->${target}`,
    source,
    target,
    type: 'relation',
    selectable: false,
    deletable: false,
    focusable: false,
    data: { kind: 'related', derived: { count } },
  }))
}

/** Members per frame, for the summary shown on collapsed groups. */
export function groupSummaries(nodes: MindNode[], membership: Map<string, string>): Map<string, MindNode[]> {
  const summaries = new Map<string, MindNode[]>()
  for (const node of nodes) {
    const frame = membership.get(node.id)
    if (!frame) continue
    const list = summaries.get(frame) ?? []
    list.push(node)
    summaries.set(frame, list)
  }
  return summaries
}

/**
 * Node id → every frame whose area contains the node's centre (largest first).
 * Unlike `frameMembership` this keeps all enclosing frames, which is what tag
 * inheritance needs: a card inside a group inside a tag group still gets the tag.
 */
export function containingFrames(nodes: MindNode[]): Map<string, string[]> {
  const frames = nodes
    .filter((node) => node.type === 'frame')
    .map((frame) => ({ id: frame.id, rect: nodeRect(frame) }))
    .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)
  const result = new Map<string, string[]>()
  if (frames.length === 0) return result
  for (const node of nodes) {
    const rect = nodeRect(node)
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const inside = frames
      .filter(
        ({ id, rect: frame }) =>
          id !== node.id &&
          cx >= frame.x &&
          cx <= frame.x + frame.width &&
          cy >= frame.y &&
          cy <= frame.y + frame.height,
      )
      .map(({ id }) => id)
    if (inside.length) result.set(node.id, inside)
  }
  return result
}
