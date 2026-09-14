import type { XYPosition } from '@xyflow/react'
import { nanoid } from 'nanoid'
import { ITEM_MIME } from './dnd'
import { createEdge, createImageNode, NODE_SIZE } from './factory'
import { htmlToLinkedText, parseZoteroQuotes, type ParsedQuote } from './quote-parse'
import { nodeId, type ItemNodeData, type MindEdge, type MindNode, type NoteNode } from './types'

/**
 * Everything that can land on the canvas besides library rows: quotes dragged or
 * copied from Zotero's PDF reader, plain text from anywhere, and image files.
 */

const MAX_TEXT_LENGTH = 20_000
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export function hasDroppableContent(types: readonly string[]): boolean {
  return (
    types.includes(ITEM_MIME) || types.includes('Files') || types.includes('text/plain') || types.includes('text/html')
  )
}

/** Picks the text flavour that still carries Zotero links, if any does. */
export function transferText(data: Pick<DataTransfer, 'getData'>): string {
  const plain = data.getData('text/plain')
  const html = data.getData('text/html')
  if (plain.includes('zotero://')) return plain
  if (html && html.includes('zotero://')) return htmlToLinkedText(html)
  return plain || (html ? htmlToLinkedText(html) : '')
}

export function createQuoteNodeFromParsed(quote: ParsedQuote, position: XYPosition, sourceTitle?: string): NoteNode {
  return {
    // Keyed like quotes pulled from the inspector, so the same highlight is not added twice.
    id: quote.annotationKey ? nodeId.item(quote.annotationKey) : `note:${nanoid(8)}`,
    type: 'note',
    position,
    data: {
      text: quote.text.slice(0, MAX_TEXT_LENGTH),
      accent: 'amber',
      sourceTitle,
      page: quote.page,
      citation: quote.citation,
      itemKey: quote.itemKey,
      libraryScope: quote.libraryScope,
      attachmentKey: quote.attachmentKey,
      pdfPage: quote.pdfPage,
      annotationKey: quote.annotationKey,
    },
    width: NODE_SIZE.note.width + 100,
  }
}

/**
 * Rough rendered height of a quote card, used to stack several dropped quotes
 * before React Flow has measured them (cards size to their text).
 */
export function estimateQuoteHeight(text: string, width: number): number {
  const charsPerLine = Math.max(20, Math.floor((width - 24) / 6.6))
  const lines = text.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  return 56 + lines * 19
}

/**
 * Quote cards (or one plain note) for dropped/pasted text. Quotes whose source
 * item is already on the board get linked to it.
 */
export function nodesFromText(
  text: string,
  position: XYPosition,
  boardNodes: MindNode[],
): { nodes: MindNode[]; edges: MindEdge[] } {
  const trimmed = text.trim()
  if (!trimmed) return { nodes: [], edges: [] }

  const quotes = parseZoteroQuotes(trimmed)
  if (quotes.length === 0) {
    return {
      nodes: [
        {
          id: `note:${nanoid(8)}`,
          type: 'note',
          position,
          data: { text: trimmed.slice(0, MAX_TEXT_LENGTH), accent: 'amber' },
          width: NODE_SIZE.note.width,
        },
      ],
      edges: [],
    }
  }

  const byId = new Map(boardNodes.map((node) => [node.id, node]))
  const nodes: MindNode[] = []
  const edges: MindEdge[] = []
  let y = position.y
  for (const quote of quotes) {
    const itemNode = quote.itemKey ? byId.get(nodeId.item(quote.itemKey)) : undefined
    const title = itemNode?.type === 'zoteroItem' ? (itemNode.data as ItemNodeData).snapshot.title : undefined
    const node = createQuoteNodeFromParsed(quote, { x: position.x, y }, title)
    y += estimateQuoteHeight(quote.text, node.width ?? NODE_SIZE.note.width) + 24
    nodes.push(node)
    if (itemNode) {
      edges.push({
        ...createEdge(itemNode.id, node.id, 'context'),
        data: { kind: 'context', label: 'highlight' },
      })
    }
  }
  return { nodes, edges }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

/** Image nodes for dropped files; oversized and non-image files are reported back. */
export async function nodesFromFiles(
  files: File[],
  position: XYPosition,
): Promise<{ nodes: MindNode[]; skipped: number }> {
  const images = files.filter((file) => file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES)
  const nodes = await Promise.all(
    images.map(async (file, index) =>
      createImageNode(await readAsDataUrl(file), { x: position.x + index * 32, y: position.y + index * 32 }, file.name),
    ),
  )
  return { nodes, skipped: files.length - images.length }
}
