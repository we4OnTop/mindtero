import type { JSONContent } from '@tiptap/react'
import { containingFrames } from './groups'
import type { FrameNodeData, ItemNodeData, MindNode } from './types'

/**
 * Tags and full-text search over a board.
 *
 * A card's tags are its own board tags, Zotero's tags for source cards, and the
 * tag of every tag group it sits in. Inherited tags are derived from position, so
 * dragging a card into a tag group tags it and dragging it out untags it.
 */

export function normalizeTag(tag: string): string {
  return tag.replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** Tag a frame hands down to its contents, or null for a plain group. */
export function frameTag(frame: MindNode): string | null {
  if (frame.type !== 'frame') return null
  const data = frame.data as FrameNodeData
  if (data.variant !== 'tag' && !data.tag) return null
  const tag = normalizeTag(data.tag ?? '')
  return tag || null
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of tags) {
    const tag = normalizeTag(raw)
    if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag)
  }
  return [...seen.values()]
}

export function ownTags(node: MindNode): string[] {
  const data = node.data as { tags?: unknown }
  const board = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : []
  const zotero = node.type === 'zoteroItem' ? ((node.data as ItemNodeData).snapshot.tags ?? []) : []
  return uniqueTags([...board, ...zotero])
}

/** Node id → tags inherited from the tag groups around it. */
export function inheritedTags(nodes: MindNode[]): Map<string, string[]> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const result = new Map<string, string[]>()
  for (const [id, frames] of containingFrames(nodes)) {
    // Groups nested in a tag group are furniture, not tagged content.
    if (byId.get(id)?.type === 'frame') continue
    const tags = frames.map((frame) => byId.get(frame)).flatMap((frame) => (frame ? (frameTag(frame) ?? []) : []))
    if (tags.length) result.set(id, uniqueTags(tags))
  }
  return result
}

export function effectiveTags(node: MindNode, inherited: Map<string, string[]>): string[] {
  return uniqueTags([...ownTags(node), ...(inherited.get(node.id) ?? []), ...(frameTag(node) ? [frameTag(node)!] : [])])
}

/** Every tag on the board with how many cards carry it, most used first. */
export function tagCounts(nodes: MindNode[]): { tag: string; count: number }[] {
  const inherited = inheritedTags(nodes)
  const counts = new Map<string, { tag: string; count: number }>()
  for (const node of nodes) {
    if (node.type === 'frame') continue
    for (const tag of effectiveTags(node, inherited)) {
      const entry = counts.get(tag.toLowerCase()) ?? { tag, count: 0 }
      entry.count += 1
      counts.set(tag.toLowerCase(), entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Plain text of a rich text document. */
export function docText(doc: JSONContent | null | undefined): string {
  if (!doc) return ''
  const parts: string[] = []
  const walk = (node: JSONContent) => {
    if (typeof node.text === 'string') parts.push(node.text)
    node.content?.forEach(walk)
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') parts.push('\n')
  }
  walk(doc)
  return parts.join('').replace(/\n{2,}/g, '\n').trim()
}

export interface SearchEntry {
  nodeId: string
  type: string
  title: string
  text: string
  tags: string[]
}

function entryFor(node: MindNode, tags: string[]): SearchEntry {
  const base = { nodeId: node.id, type: node.type ?? 'unknown', tags }
  switch (node.type) {
    case 'zoteroItem': {
      const { snapshot, comment } = node.data as ItemNodeData
      return {
        ...base,
        title: snapshot.title,
        text: [snapshot.creatorSummary, snapshot.year, snapshot.source, comment, snapshot.abstract].filter(Boolean).join(' · '),
      }
    }
    case 'note':
      return {
        ...base,
        title: node.data.citation ?? (node.data.sourceTitle ? `Quote · ${node.data.sourceTitle}` : 'Note'),
        text: [node.data.text, node.data.sourceTitle].filter(Boolean).join('\n'),
      }
    case 'claim':
      return { ...base, title: 'Claim', text: node.data.text }
    case 'question':
      return { ...base, title: node.data.code || 'Research question', text: node.data.text }
    case 'richText':
      return { ...base, title: 'Text block', text: docText(node.data.doc) }
    case 'frame':
      return { ...base, title: node.data.label || 'Group', text: node.data.tag ?? '' }
    case 'timeline':
      return {
        ...base,
        title: node.data.label,
        text: node.data.entries.map((entry) => [entry.title, entry.creatorSummary, entry.note].filter(Boolean).join(' ')).join('\n'),
      }
    case 'image':
      return { ...base, title: node.data.caption || 'Image', text: '' }
    case 'tag':
      return { ...base, title: `#${node.data.tag}`, text: '' }
    case 'creator':
      return { ...base, title: node.data.name, text: 'Author' }
    case 'collection':
      return { ...base, title: node.data.name, text: 'Collection' }
    default:
      return { ...base, title: 'Card', text: '' }
  }
}

export function searchEntries(nodes: MindNode[]): SearchEntry[] {
  const inherited = inheritedTags(nodes)
  return nodes.map((node) => entryFor(node, effectiveTags(node, inherited)))
}

/** Case- and accent-insensitive form used for matching. */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export interface SearchQuery {
  terms: string[]
  tags: string[]
}

/** `#software engineering` style tags may contain spaces when quoted: `#"software engineering"`. */
export function parseQuery(query: string): SearchQuery {
  const terms: string[] = []
  const tags: string[] = []
  for (const match of query.matchAll(/#"([^"]+)"|#(\S+)|"([^"]+)"|(\S+)/g)) {
    const [, quotedTag, tag, phrase, word] = match
    if (quotedTag ?? tag) tags.push(fold(normalizeTag(quotedTag ?? tag ?? '')))
    else if (phrase ?? word) terms.push(fold(phrase ?? word ?? ''))
  }
  return { terms: terms.filter(Boolean), tags: tags.filter(Boolean) }
}

export interface SearchHit {
  entry: SearchEntry
  score: number
  snippet: string
}

function snippetAround(text: string, term: string | undefined): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!term) return flat.slice(0, 140)
  const index = fold(flat).indexOf(term)
  if (index < 0) return flat.slice(0, 140)
  // Start at a word boundary so the snippet does not open mid-word.
  const rough = Math.max(0, index - 50)
  const space = flat.lastIndexOf(' ', rough)
  const start = rough === 0 ? 0 : space >= 0 && rough - space < 20 ? space + 1 : rough
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 140)}${start + 140 < flat.length ? '…' : ''}`
}

/**
 * Every plain term must appear somewhere (title, text or tags); every `#tag` must
 * prefix-match one of the card's tags. Title hits rank above tag and text hits.
 */
export function searchBoard(entries: SearchEntry[], query: string, limit = 60): SearchHit[] {
  const { terms, tags } = parseQuery(query)
  if (terms.length === 0 && tags.length === 0) return []
  const hits: SearchHit[] = []
  for (const entry of entries) {
    const title = fold(entry.title)
    const text = fold(entry.text)
    const entryTags = entry.tags.map(fold)
    if (!tags.every((tag) => entryTags.some((candidate) => candidate.startsWith(tag)))) continue
    let score = tags.length * 2
    let matched = true
    for (const term of terms) {
      const inTitle = title.includes(term)
      const inTags = entryTags.some((candidate) => candidate.includes(term))
      const inText = text.includes(term)
      if (!inTitle && !inTags && !inText) {
        matched = false
        break
      }
      score += (inTitle ? 3 : 0) + (inTags ? 2 : 0) + (inText ? 1 : 0)
    }
    if (!matched) continue
    hits.push({ entry, score, snippet: snippetAround(entry.text || entry.title, terms[0]) })
  }
  return hits.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).slice(0, limit)
}

/** One-line human label for a card, for lists in the inspector. */
export function cardLabel(node: MindNode): string {
  const entry = entryFor(node, [])
  const text = entry.text.replace(/\s+/g, ' ').trim()
  switch (node.type) {
    case 'note':
      return node.data.citation ? `${node.data.citation}: ${text}` : text || 'Empty note'
    case 'claim':
      return text || 'Untitled claim'
    case 'question':
      return `${entry.title}: ${text || 'Untitled question'}`
    case 'richText':
      return text || 'Empty text block'
    default:
      return entry.title
  }
}
