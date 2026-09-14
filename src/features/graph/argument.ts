import { containingFrames } from './groups'
import { nodeId, type MindEdge, type MindNode } from './types'

/**
 * Reading the argument structure out of a board: which evidence backs a claim,
 * what belongs to a research question, and where the argument has holes.
 * Everything is derived from cards and connections, so it can never drift out of
 * sync with what the board actually shows.
 */

export type ClaimStatus = 'unsupported' | 'supported' | 'contested' | 'contradicted'

export interface ClaimEvidence {
  supporting: MindNode[]
  contradicting: MindNode[]
  status: ClaimStatus
}

/** Quote cards are notes that came from a source. */
export function isQuote(node: MindNode): boolean {
  return node.type === 'note' && Boolean(node.data.citation ?? node.data.sourceTitle ?? node.data.itemKey)
}

/** Sources, quotes and figures: the material an argument rests on. */
export function isEvidence(node: MindNode): boolean {
  return node.type === 'zoteroItem' || node.type === 'image' || isQuote(node)
}

function claimStatus(supporting: number, contradicting: number): ClaimStatus {
  if (supporting === 0 && contradicting === 0) return 'unsupported'
  if (contradicting === 0) return 'supported'
  if (supporting === 0) return 'contradicted'
  return 'contested'
}

/**
 * Evidence for a claim, from `supports` / `contradicts` connections.
 *
 * Connections read "A supports B", so the other end of an edge that *ends* at the
 * claim counts. Because people draw connections from either card, an edge that
 * *starts* at the claim counts as well — unless it points at another claim, where
 * it means this claim backs that one.
 */
export function claimEvidence(claimId: string, nodes: MindNode[], edges: MindEdge[]): ClaimEvidence {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const supporting = new Map<string, MindNode>()
  const contradicting = new Map<string, MindNode>()
  for (const edge of edges) {
    const kind = edge.data?.kind
    if (kind !== 'supports' && kind !== 'contradicts') continue
    let otherId: string | null = null
    if (edge.target === claimId) otherId = edge.source
    else if (edge.source === claimId && byId.get(edge.target)?.type !== 'claim') otherId = edge.target
    const other = otherId ? byId.get(otherId) : undefined
    if (!other || other.id === claimId) continue
    const bucket = kind === 'supports' ? supporting : contradicting
    bucket.set(other.id, other)
  }
  return {
    supporting: [...supporting.values()],
    contradicting: [...contradicting.values()],
    status: claimStatus(supporting.size, contradicting.size),
  }
}

/**
 * Everything anchored to a research question: cards reachable from it through
 * connections in either direction. Another research question is a boundary, and a
 * connected frame brings its contents along.
 */
export function questionScope(questionId: string, nodes: MindNode[], edges: MindEdge[]): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const neighbours = new Map<string, string[]>()
  const link = (from: string, to: string) => {
    const list = neighbours.get(from)
    if (list) list.push(to)
    else neighbours.set(from, [to])
  }
  for (const edge of edges) {
    if (edge.data?.derived) continue
    link(edge.source, edge.target)
    link(edge.target, edge.source)
  }
  // One-way: reaching a frame brings its contents, reaching a card does not pull
  // in every frame it happens to sit in.
  for (const [member, frames] of containingFrames(nodes)) {
    for (const frame of frames) link(frame, member)
  }

  const scope = new Set<string>()
  const queue = [questionId]
  while (queue.length) {
    const current = queue.shift()!
    for (const id of neighbours.get(current) ?? []) {
      if (id === questionId || scope.has(id)) continue
      const node = byId.get(id)
      if (!node || node.type === 'question') continue
      scope.add(id)
      queue.push(id)
    }
  }
  return scope
}

export type GapSeverity = 'high' | 'medium' | 'low'

export interface Gap {
  nodeId: string
  severity: GapSeverity
  message: string
}

const SEVERITY_ORDER: Record<GapSeverity, number> = { high: 0, medium: 1, low: 2 }

/** Weak spots in the argument, most serious first. */
export function findGaps(nodes: MindNode[], edges: MindEdge[]): Gap[] {
  const gaps: Gap[] = []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const questions = nodes.filter((node) => node.type === 'question')
  const scopes = new Map(questions.map((question) => [question.id, questionScope(question.id, nodes, edges)]))
  const anchored = new Set([...scopes.values()].flatMap((scope) => [...scope]))

  for (const node of nodes) {
    if (node.type !== 'claim') continue
    const evidence = claimEvidence(node.id, nodes, edges)
    if (evidence.status === 'unsupported') {
      gaps.push({ nodeId: node.id, severity: 'high', message: 'Claim has no evidence yet' })
    } else if (evidence.status === 'contradicted') {
      gaps.push({ nodeId: node.id, severity: 'high', message: 'Claim is only contradicted' })
    } else if (evidence.contradicting.length > evidence.supporting.length) {
      gaps.push({ nodeId: node.id, severity: 'medium', message: 'Claim is contradicted more than supported' })
    }
    if (questions.length && !anchored.has(node.id)) {
      gaps.push({ nodeId: node.id, severity: 'low', message: 'Claim is not tied to a research question' })
    }
  }

  for (const question of questions) {
    const scope = [...(scopes.get(question.id) ?? [])]
      .map((id) => byId.get(id))
      .filter((node): node is MindNode => Boolean(node))
    if (!scope.some((node) => node.type === 'claim' || isEvidence(node))) {
      gaps.push({ nodeId: question.id, severity: 'high', message: 'Research question has no claims or sources yet' })
    } else if (!scope.some((node) => node.type === 'claim')) {
      gaps.push({ nodeId: question.id, severity: 'medium', message: 'No claim answers this question yet' })
    }
  }

  // A source is "used" once it takes a stance or touches a claim or question.
  const used = new Set<string>()
  const argumentative = (node: MindNode) => node.type === 'claim' || node.type === 'question'
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue
    const stance = edge.data?.kind === 'supports' || edge.data?.kind === 'contradicts'
    if (stance || argumentative(target)) used.add(source.id)
    if (stance || argumentative(source)) used.add(target.id)
  }
  // A source whose quotes are used is used through them — whether the quote knows
  // its item key or is only linked to the source card by its "highlight" line.
  for (const node of nodes) {
    if (node.type === 'note' && used.has(node.id) && node.data.itemKey) used.add(nodeId.item(node.data.itemKey))
  }
  for (const edge of edges) {
    if (edge.data?.label !== 'highlight') continue
    // Highlight lines always run source card → quote; only the quote lends usage.
    if (used.has(edge.target)) used.add(edge.source)
  }
  for (const node of nodes) {
    if ((node.type === 'zoteroItem' || isQuote(node)) && !used.has(node.id)) {
      gaps.push({
        nodeId: node.id,
        severity: 'low',
        message: node.type === 'zoteroItem' ? 'Source is not used in any argument' : 'Quote is not used in any argument',
      })
    }
  }

  return gaps.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}
