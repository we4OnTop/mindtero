import type { Edge, Node, Viewport } from '@xyflow/react'
import type { JSONContent } from '@tiptap/react'
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
  /** Board-level tags (Zotero's own tags stay in `snapshot.tags`). */
  tags?: string[]
}

export type NoteNodeData = {
  text: string
  accent?: Accent
  /** When this note is a highlight/quote pulled from a Zotero item. */
  sourceTitle?: string
  /** Zotero page label of the annotation (if any). */
  page?: string
  /** Citation label as Zotero formats it, e.g. "Cheng et al., 2026, p. 142". */
  citation?: string
  /** Parent Zotero item of the quote. */
  itemKey?: string
  /** PDF attachment the quote was taken from — enables "open PDF at this page". */
  attachmentKey?: string
  /** 1-based page index inside the PDF (not the printed page label). */
  pdfPage?: number
  /** Zotero annotation key, so Zotero can jump straight to the highlight. */
  annotationKey?: string
  /** `library` or `groups/<id>`, as used in zotero:// URLs. */
  libraryScope?: string
  tags?: string[]
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

export const FRAME_WEIGHTS = ['thin', 'medium', 'thick', 'heavy'] as const
export type FrameWeight = (typeof FRAME_WEIGHTS)[number]

export type FrameNodeData = {
  label: string
  accent?: Accent
  /** Optional tag this group "belongs" to; shown as a chip in the frame header. */
  tag?: string
  /** Border thickness; older boards have none and render as `medium`. */
  weight?: FrameWeight
  /** Border line; older boards render dashed. */
  lineStyle?: 'dashed' | 'solid'
  /**
   * `tag`: a tag group — every card inside inherits `tag`, which search and
   * the gap view pick up. Frames made by "Group under a tag" already carry a tag
   * and behave the same way.
   */
  variant?: 'tag'
}

export type ImageNodeData = {
  /** data: URL (uploaded/snipped) or http(s) URL. */
  src: string
  caption?: string
  tags?: string[]
}

/**
 * A statement the thesis makes. Evidence is not stored on the card: it is read
 * from `supports` / `contradicts` connections, so the counts stay truthful.
 */
export type ClaimNodeData = {
  text: string
  accent?: Accent
  tags?: string[]
}

/** A research question that claims and sources are anchored to via connections. */
export type QuestionNodeData = {
  /** Short handle such as "RQ1". */
  code: string
  text: string
  tags?: string[]
}

export type RichTextNodeData = {
  /** Tiptap/ProseMirror document. Stored as JSON, never as HTML. */
  doc: JSONContent | null
  accent?: Accent
  tags?: string[]
}

export type TimelineEntry = {
  id: string
  /** Zotero item this span belongs to, when it came from the library. */
  itemKey?: string
  title: string
  creatorSummary?: string
  /** Publication year, drawn as a marker on the span. */
  year?: string
  /** First and last year of the research period the source covers. */
  from: number
  to: number
  note?: string
  accent?: Accent
}

export type TimelineNodeData = {
  label: string
  /** Axis bounds; derived from the entries when unset. */
  from?: number
  to?: number
  entries: TimelineEntry[]
}

export type ItemNode = Node<ItemNodeData, 'zoteroItem'>
export type NoteNode = Node<NoteNodeData, 'note'>
export type TagNode = Node<TagNodeData, 'tag'>
export type CreatorNode = Node<CreatorNodeData, 'creator'>
export type CollectionNode = Node<CollectionNodeData, 'collection'>
export type FrameNode = Node<FrameNodeData, 'frame'>
export type ImageNode = Node<ImageNodeData, 'image'>
export type RichTextNode = Node<RichTextNodeData, 'richText'>
export type TimelineNode = Node<TimelineNodeData, 'timeline'>
export type ClaimNode = Node<ClaimNodeData, 'claim'>
export type QuestionNode = Node<QuestionNodeData, 'question'>

export type MindNode =
  | ItemNode
  | NoteNode
  | TagNode
  | CreatorNode
  | CollectionNode
  | FrameNode
  | ImageNode
  | RichTextNode
  | TimelineNode
  | ClaimNode
  | QuestionNode
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
  /**
   * Computed group-to-group link shown in the "groups" detail level. Never stored
   * on a board; it summarises the connections between the members of two frames.
   */
  derived?: { count: number }
  /**
   * On a connection between a research timeline and a source: the years of
   * research the source covers, drawn as its Gantt bar.
   */
  period?: { from: number; to: number }
  /** Bar colour on the timeline. */
  accent?: Accent
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
