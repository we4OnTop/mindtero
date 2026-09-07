import { useQueryClient } from '@tanstack/react-query'
import type { XYPosition } from '@xyflow/react'
import { useCallback } from 'react'
import { creatorName, parseRelatedKeys } from '@/features/zotero/format'
import { useZoteroSource } from '@/features/zotero/provider'
import { zoteroKeys } from '@/features/zotero/queries'
import type { ZoteroSource } from '@/features/zotero/source'
import type { ZoteroCollection, ZoteroItem } from '@/features/zotero/types'
import {
  createCollectionNode,
  createCreatorNode,
  createEdge,
  createItemNode,
  createNoteNodeFromZotero,
  createQuoteNode,
  createTagNode,
  ringPositions,
} from './factory'
import { itemTitle } from '@/features/zotero/format'
import { useBoards } from './store'
import { nodeId, type MindEdge, type MindNode } from './types'

export const EXPANSIONS = [
  {
    kind: 'related',
    label: 'Related items',
    description: 'Items linked with Zotero’s own “Related” field.',
  },
  { kind: 'notes', label: 'Child notes', description: 'Notes attached to this item in Zotero.' },
  {
    kind: 'highlights',
    label: 'PDF highlights',
    description: 'Quote cards from the annotations in this item’s PDFs.',
  },
  { kind: 'authors', label: 'Authors', description: 'One node per creator.' },
  { kind: 'tags', label: 'Tags', description: 'One node per tag.' },
  { kind: 'collections', label: 'Collections', description: 'Collections containing this item.' },
  {
    kind: 'sharedTags',
    label: 'Items sharing a tag',
    description: 'Other items carrying the same tags.',
  },
  {
    kind: 'sameCollection',
    label: 'Neighbours in collection',
    description: 'Other items in the same collections.',
  },
] as const

export type ExpansionKind = (typeof EXPANSIONS)[number]['kind']

/** Cap on how many nodes a single expansion may add, so one click cannot flood the board. */
const MAX_NEW_NODES = 12

interface ExpansionResult {
  nodes: MindNode[]
  edges: MindEdge[]
}

async function buildExpansion(
  source: ZoteroSource,
  item: ZoteroItem,
  kind: ExpansionKind,
  origin: XYPosition,
  collections: ZoteroCollection[],
): Promise<ExpansionResult> {
  const originId = nodeId.item(item.key)

  /** Places `entries` on a ring and wires each back to the expanded node. */
  const place = <T,>(
    entries: T[],
    make: (entry: T, position: XYPosition) => MindNode,
    label: string,
    edgeKind: 'related' | 'context' | 'cites' = 'related',
  ): ExpansionResult => {
    const limited = entries.slice(0, MAX_NEW_NODES)
    const positions = ringPositions(origin, limited.length)
    const nodes = limited.map((entry, index) => make(entry, positions[index]!))
    const edges = nodes.map((node) => ({
      ...createEdge(originId, node.id, edgeKind),
      data: { kind: edgeKind, label },
    }))
    return { nodes, edges }
  }

  switch (kind) {
    case 'related': {
      const keys = parseRelatedKeys(item.data.relations)
      const related = await source.getItemsByKeys(keys)
      return place(related, (entry, position) => createItemNode(entry, position), 'related')
    }

    case 'notes': {
      const children = await source.getChildren(item.key)
      const notes = children.filter((child) => child.data.itemType === 'note')
      return place(notes, (entry, position) => createNoteNodeFromZotero(entry, position), 'note')
    }

    case 'highlights': {
      const children = await source.getChildren(item.key)
      const attachments = children.filter((child) => child.data.itemType === 'attachment')
      if (attachments.length === 0) return { nodes: [], edges: [] }
      // Annotations live one level deeper: they are children of the attachment.
      const pages = await Promise.all(attachments.map((entry) => source.getChildren(entry.key)))
      const annotations = pages.flat().filter((entry) => entry.data.itemType === 'annotation')
      const quotes = annotations.filter((entry) =>
        typeof entry.data.annotationText === 'string' && entry.data.annotationText,
      )
      const title = itemTitle(item)
      return place(
        quotes,
        (entry, position) => createQuoteNode(entry, title, position),
        'highlight from this source',
        'context',
      )
    }

    case 'authors': {
      const names = (item.data.creators ?? []).map(creatorName).filter(Boolean)
      return place(names, (name, position) => createCreatorNode(name, position), 'author')
    }

    case 'tags': {
      const tags = (item.data.tags ?? []).map((tag) => tag.tag)
      return place(tags, (tag, position) => createTagNode(tag, position), 'tag')
    }

    case 'collections': {
      const byKey = new Map(collections.map((collection) => [collection.key, collection]))
      const entries = (item.data.collections ?? [])
        .map((key) => byKey.get(key))
        .filter((collection): collection is ZoteroCollection => Boolean(collection))
      return place(
        entries,
        (collection, position) => createCollectionNode(collection.key, collection.data.name, position),
        'in collection',
      )
    }

    case 'sharedTags': {
      const tags = (item.data.tags ?? []).map((tag) => tag.tag).slice(0, 4)
      if (tags.length === 0) return { nodes: [], edges: [] }
      const pages = await Promise.all(
        tags.map((tag) => source.getItems({ tag, limit: 6, top: true })),
      )
      const neighbours = dedupeItems(pages.flatMap((page) => page.items), item.key)
      return place(neighbours, (entry, position) => createItemNode(entry, position), 'shared tag')
    }

    case 'sameCollection': {
      const keys = (item.data.collections ?? []).slice(0, 3)
      if (keys.length === 0) return { nodes: [], edges: [] }
      const pages = await Promise.all(
        keys.map((collectionKey) => source.getItems({ collectionKey, limit: 6, top: true })),
      )
      const neighbours = dedupeItems(pages.flatMap((page) => page.items), item.key)
      return place(neighbours, (entry, position) => createItemNode(entry, position), 'same collection')
    }

    default:
      return { nodes: [], edges: [] }
  }
}

function dedupeItems(items: ZoteroItem[], excludeKey: string): ZoteroItem[] {
  const seen = new Set([excludeKey])
  const out: ZoteroItem[] = []
  for (const item of items) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    out.push(item)
  }
  return out
}

export interface ExpandTarget {
  itemKey: string
  /** Absolute canvas position of the node being expanded. */
  position: XYPosition
}

export interface ExpandOutcome {
  added: number
  skipped: number
}

/**
 * Grows the graph one hop out from an item node. Nodes that already exist are not
 * duplicated (ids are deterministic) but their edge to the origin is still drawn.
 */
export function useExpandNode() {
  const source = useZoteroSource()
  const queryClient = useQueryClient()
  const addNodes = useBoards((state) => state.addNodes)
  const addEdges = useBoards((state) => state.addEdges)

  return useCallback(
    async (target: ExpandTarget, kind: ExpansionKind): Promise<ExpandOutcome> => {
      const [item, collections] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: zoteroKeys.item(source.id, target.itemKey),
          queryFn: ({ signal }) => source.getItem(target.itemKey, signal),
          staleTime: 60_000,
        }),
        queryClient.fetchQuery({
          queryKey: zoteroKeys.collections(source.id),
          queryFn: ({ signal }) => source.getCollections(signal),
          staleTime: 5 * 60_000,
        }),
      ])

      const { nodes, edges } = await buildExpansion(source, item, kind, target.position, collections)
      const existing = new Set(
        (useBoards.getState().boards[useBoards.getState().activeBoardId ?? '']?.nodes ?? []).map(
          (entry) => entry.id,
        ),
      )
      const fresh = nodes.filter((entry) => !existing.has(entry.id))

      addNodes(fresh)
      addEdges(edges)
      return { added: fresh.length, skipped: nodes.length - fresh.length }
    },
    [source, queryClient, addNodes, addEdges],
  )
}
