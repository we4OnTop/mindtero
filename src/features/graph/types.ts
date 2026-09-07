import type { Edge, Node, Viewport } from '@xyflow/react'
import type { RelationKind } from './relations'

/**
 * Node data types are declared as type aliases (not interfaces) on purpose:
 * React Flow requires `Record<string, unknown>` compatibility, which only type
 * aliases satisfy through their implicit index signature.
 */

export const ACCENTS = ['neutral', 'violet', 'sky', 'emerald', 'amber', 'rose', 'cyan'] as const
export type Accent = (typeof ACCENTS)[number]

/**
 * Denormalised copy of the Zotero fields a node needs to render. Keeps boards
 * readable while Zotero is closed; refreshed from the API whenever it is running.
 */
export type ItemSnapshot = {
  key: string
  title: string
  creatorSummary: string
  year: string
  itemType: string
  source?: string
  doi?: string
  url?: string
  tags?: string[]
  abstract?: string
  numChildren?: number
  /** When the snapshot was last refreshed from Zotero. */
  fetchedAt?: string
}

export type ItemNodeData = {
  itemKey: string
  snapshot: ItemSnapshot
  accent?: Accent
  /** Collapsed nodes render as a compact chip. */
  collapsed?: boolean
  /** The user's own comment about this item *on this board*. */
  comment?: string
}

export type NoteNodeData = {
  text: string
  accent?: Accent
  /** When this note is a highlight/quote pulled from a Zotero item. */
  sourceTitle?: string
  /** Zotero page label of the annotation (if any). */
  page?: string
}

export type TagNodeData = {
  tag: string
}

export type CreatorNodeData = {
  name: string
}

export type CollectionNodeData = {
  collectionKey: string
  name: string
}

export type FrameNodeData = {
  label: string
  accent?: Accent
  /** Optional tag this group "belongs" to; shown as a chip in the frame header. */
  tag?: string
}

export type ImageNodeData = {
  /** data: URL (uploaded/snipped) or http(s) URL. */
  src: string
  caption?: string
}

export type ItemNode = Node<ItemNodeData, 'zoteroItem'>
export type NoteNode = Node<NoteNodeData, 'note'>
export type TagNode = Node<TagNodeData, 'tag'>
export type CreatorNode = Node<CreatorNodeData, 'creator'>
export type CollectionNode = Node<CollectionNodeData, 'collection'>
export type FrameNode = Node<FrameNodeData, 'frame'>
export type ImageNode = Node<ImageNodeData, 'image'>

export type MindNode =
  | ItemNode
  | NoteNode
  | TagNode
  | CreatorNode
  | CollectionNode
  | FrameNode
  | ImageNode
export type MindNodeType = MindNode['type']

export const EDGE_SHAPES = ['bezier', 'straight', 'step', 'smoothstep'] as const
export type EdgeShape = (typeof EDGE_SHAPES)[number]

export const EDGE_SHAPE_LABELS: Record<EdgeShape, string> = {
  bezier: 'Curved',
  straight: 'Straight',
  step: 'Squared',
  smoothstep: 'Rounded corners',
}

export type RelationEdgeData = {
  kind: RelationKind
  /** Overrides the relation's default label. */
  label?: string
  note?: string
  /** Line routing style; falls back to the global default. */
  shape?: EdgeShape
  /** Manually dragged control point (flow coordinates) that bends the line. */
  bend?: { x: number; y: number }
}

export type MindEdge = Edge<RelationEdgeData, 'relation'>

export interface Board {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  nodes: MindNode[]
  edges: MindEdge[]
  viewport?: Viewport
}

/** Deterministic node ids give free de-duplication when the same entity is added twice. */
export const nodeId = {
  item: (key: string) => `item:${key}`,
  tag: (tag: string) => `tag:${tag}`,
  creator: (name: string) => `creator:${name}`,
  collection: (key: string) => `collection:${key}`,
}

export function isItemNode(node: MindNode): node is ItemNode {
  return node.type === 'zoteroItem'
}

export function isNoteNode(node: MindNode): node is NoteNode {
  return node.type === 'note'
}
