import type { XYPosition } from '@xyflow/react'
import { nanoid } from 'nanoid'
import { creatorSummary, itemSource, itemTitle, itemYear, stripHtml } from '@/features/zotero/format'
import type { ZoteroItem } from '@/features/zotero/types'
import { DEFAULT_RELATION, type RelationKind } from './relations'
import {
  nodeId,
  type ClaimNode,
  type CollectionNode,
  type CreatorNode,
  type FrameNode,
  type ImageNode,
  type ItemNode,
  type ItemSnapshot,
  type MindEdge,
  type NoteNode,
  type QuestionNode,
  type RichTextNode,
  type TagNode,
  type TimelineEntry,
  type TimelineNode,
} from './types'

export const NODE_SIZE = {
  item: { width: 268, height: 132 },
  note: { width: 220, height: 120 },
  chip: { width: 176, height: 48 },
  frame: { width: 520, height: 360 },
  image: { width: 240, height: 200 },
  richText: { width: 360, height: 180 },
  timeline: { width: 760, height: 240 },
  claim: { width: 300, height: 110 },
  question: { width: 340, height: 120 },
}

/**
 * Cards whose height follows their content only get a width; see
 * AUTO_HEIGHT_TYPES in board-io.ts. The heights above remain layout estimates.
 */
const widthOf = (size: { width: number }) => ({ width: size.width })

export function toSnapshot(item: ZoteroItem): ItemSnapshot {
  return {
    key: item.key,
    title: itemTitle(item),
    creatorSummary: creatorSummary(item),
    year: itemYear(item),
    itemType: item.data.itemType,
    source: itemSource(item) || undefined,
    doi: typeof item.data.DOI === 'string' && item.data.DOI ? item.data.DOI : undefined,
    url: typeof item.data.url === 'string' && item.data.url ? item.data.url : undefined,
    tags: (item.data.tags ?? []).map((tag) => tag.tag),
    abstract:
      typeof item.data.abstractNote === 'string' && item.data.abstractNote
        ? item.data.abstractNote
        : undefined,
    numChildren: item.meta?.numChildren,
    fetchedAt: new Date().toISOString(),
  }
}

export function createItemNode(item: ZoteroItem, position: XYPosition): ItemNode {
  return {
    id: nodeId.item(item.key),
    type: 'zoteroItem',
    position,
    data: { itemKey: item.key, snapshot: toSnapshot(item) },
    ...widthOf(NODE_SIZE.item),
  }
}

export function createNoteNode(position: XYPosition, text = ''): NoteNode {
  return {
    id: `note:${nanoid(8)}`,
    type: 'note',
    position,
    data: { text, accent: 'amber' },
    ...widthOf(NODE_SIZE.note),
  }
}

export function createClaimNode(position: XYPosition): ClaimNode {
  return {
    id: `claim:${nanoid(8)}`,
    type: 'claim',
    position,
    data: { text: '' },
    ...widthOf(NODE_SIZE.claim),
  }
}

/** Numbers research questions RQ1, RQ2, … after the highest one already on the board. */
export function nextQuestionCode(existing: string[]): string {
  const numbers = existing.map((code) => /^RQ(\d+)$/i.exec(code.trim())?.[1]).map(Number).filter(Number.isFinite)
  return `RQ${(numbers.length ? Math.max(...numbers) : 0) + 1}`
}

export function createQuestionNode(position: XYPosition, code: string): QuestionNode {
  return {
    id: `question:${nanoid(8)}`,
    type: 'question',
    position,
    data: { code, text: '' },
    ...widthOf(NODE_SIZE.question),
  }
}

export function createRichTextNode(position: XYPosition): RichTextNode {
  return {
    id: `richText:${nanoid(8)}`,
    type: 'richText',
    position,
    data: { doc: null, accent: 'neutral' },
    ...widthOf(NODE_SIZE.richText),
  }
}

export function createTimelineNode(position: XYPosition, label = 'Research timeline'): TimelineNode {
  return {
    id: `timeline:${nanoid(8)}`,
    type: 'timeline',
    position,
    data: { label, entries: [] },
    ...widthOf(NODE_SIZE.timeline),
  }
}

/**
 * A timeline span for a source. The span starts as the publication year alone;
 * the user then stretches it to the research period the source actually covers.
 */
export function createTimelineEntry(source: {
  itemKey?: string
  title: string
  creatorSummary?: string
  year?: string
}): TimelineEntry {
  const year = Number.parseInt(source.year ?? '', 10)
  const anchor = Number.isFinite(year) ? year : new Date().getFullYear()
  return {
    id: nanoid(8),
    ...source,
    from: anchor - 5,
    to: anchor,
  }
}

export function createTagNode(tag: string, position: XYPosition): TagNode {
  return { id: nodeId.tag(tag), type: 'tag', position, data: { tag } }
}

export function createCreatorNode(name: string, position: XYPosition): CreatorNode {
  return { id: nodeId.creator(name), type: 'creator', position, data: { name } }
}

export function createCollectionNode(
  key: string,
  name: string,
  position: XYPosition,
): CollectionNode {
  return {
    id: nodeId.collection(key),
    type: 'collection',
    position,
    data: { collectionKey: key, name },
    style: { width: 'max-content', maxWidth: 208 },
  }
}

export function createFrameNode(position: XYPosition, label = 'Theme', variant?: 'tag'): FrameNode {
  return {
    id: `frame:${nanoid(8)}`,
    type: 'frame',
    position,
    data: variant
      ? { label, accent: 'emerald', variant, tag: '', weight: 'thick', lineStyle: 'solid' }
      : { label, accent: 'neutral' },
    ...NODE_SIZE.frame,
    // Frames sit behind everything else and must not swallow clicks meant for cards.
    zIndex: -1,
    selectable: true,
    draggable: true,
  }
}

interface FrameBoundsInput {
  x: number
  y: number
  width?: number
  height?: number
}

const DEFAULT_CARD_SIZE = { width: 268, height: 132 }

/** Bounding box (with padding) around `nodes`, for wrapping them in a frame. */
export function frameBounds(nodes: FrameBoundsInput[]): {
  position: XYPosition
  width: number
  height: number
} {
  const PADDING = 48
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const width = node.width ?? DEFAULT_CARD_SIZE.width
    const height = node.height ?? DEFAULT_CARD_SIZE.height
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + width)
    maxY = Math.max(maxY, node.y + height)
  }
  if (!Number.isFinite(minX)) return { position: { x: 0, y: 0 }, width: NODE_SIZE.frame.width, height: NODE_SIZE.frame.height }
  return {
    position: { x: minX - PADDING, y: minY - PADDING - 12 },
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2 + 12,
  }
}

/**
 * Groups `members` into a frame labelled with `tag`, plus the tag chip so the
 * group is queryable like every other tag node. The chip is deterministic
 * (`tag:<name>`) and usually already exists when the tag was expanded before.
 */
export function createTagFrame(
  tag: string,
  bounds: { position: XYPosition; width: number; height: number },
  memberIds: string[],
): { frame: FrameNode; tagNode: TagNode; edges: MindEdge[] } {
  const frame: FrameNode = {
    id: `frame:${tag.replace(/\s+/g, '-')}:${nanoid(4)}`,
    type: 'frame',
    position: bounds.position,
    data: { label: tag, accent: 'neutral', tag },
    style: { width: bounds.width, height: bounds.height },
    zIndex: -1,
    selectable: true,
    draggable: true,
  }

  const tagNode: TagNode = {
    id: nodeId.tag(tag),
    type: 'tag',
    position: { x: bounds.position.x + 16, y: bounds.position.y + 16 },
    data: { tag },
  }

  const members = memberIds.filter((id) => !id.startsWith('frame:'))
  return { frame, tagNode, edges: memberEdges(tagNode.id, members) }
}

function memberEdges(tagSourceId: string, memberIds: string[]): MindEdge[] {
  return memberIds.map((id) => ({
    ...createEdge(tagSourceId, id, 'context'),
    data: { kind: 'context' as const, label: 'tag' },
  }))
}

export function createImageNode(src: string, position: XYPosition, caption?: string): ImageNode {
  return {
    id: `image:${nanoid(8)}`,
    type: 'image',
    position,
    data: { src, ...(caption ? { caption } : {}) },
    ...NODE_SIZE.image,
  }
}

/** A note node holding the text of a Zotero child note. */
export function createNoteNodeFromZotero(item: ZoteroItem, position: XYPosition): NoteNode {
  return {
    id: nodeId.item(item.key),
    type: 'note',
    position,
    data: { text: stripHtml(String(item.data.note ?? '')), accent: 'cyan' },
    ...widthOf(NODE_SIZE.note),
  }
}

interface AnnotationLike {
  key: string
  data: {
    annotationText?: unknown
    annotationComment?: unknown
    annotationPageLabel?: unknown
    annotationPosition?: unknown
    parentItem?: unknown
    [field: string]: unknown
  }
}

/** Zotero stores a 0-based `pageIndex` inside the JSON-encoded annotation position. */
export function annotationPdfPage(position: unknown): number | undefined {
  try {
    const parsed: unknown = typeof position === 'string' ? JSON.parse(position) : position
    const index = (parsed as { pageIndex?: unknown } | null)?.pageIndex
    return typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index + 1 : undefined
  } catch {
    return undefined
  }
}

/** A quote card built from a Zotero PDF annotation (highlight). */
export function createQuoteNode(
  annotation: AnnotationLike,
  sourceTitle: string,
  position: XYPosition,
  itemKey?: string,
): NoteNode {
  const text = stripHtml(String(annotation.data.annotationText ?? ''))
  const page = typeof annotation.data.annotationPageLabel === 'string'
    ? annotation.data.annotationPageLabel
    : undefined
  return {
    id: nodeId.item(annotation.key),
    type: 'note',
    position,
    data: {
      text,
      accent: 'amber',
      sourceTitle,
      page: page || undefined,
      itemKey,
      attachmentKey: typeof annotation.data.parentItem === 'string' ? annotation.data.parentItem : undefined,
      pdfPage: annotationPdfPage(annotation.data.annotationPosition),
      annotationKey: annotation.key,
    },
    ...widthOf(NODE_SIZE.note),
  }
}

export function createEdge(
  source: string,
  target: string,
  kind: RelationKind = DEFAULT_RELATION,
): MindEdge {
  return {
    id: `edge:${source}->${target}:${kind}`,
    source,
    target,
    type: 'relation',
    data: { kind },
  }
}

/** Lays out `count` points on a ring around `origin`, avoiding overlap with the centre node. */
export function ringPositions(
  origin: XYPosition,
  count: number,
  radius = 320,
  startAngle = -Math.PI / 2,
): XYPosition[] {
  if (count === 0) return []
  const step = (Math.PI * 2) / Math.max(count, 3)
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + step * index
    return {
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * (radius * 0.7),
    }
  })
}
