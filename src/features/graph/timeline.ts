import { cardLabel } from './board-search'
import type { Accent, ItemNodeData, MindEdge, MindNode, TimelineEntry, TimelineNodeData } from './types'

/**
 * Pure logic for the research timeline (a Gantt chart of sources).
 *
 * Sources are attached with a connection from the timeline to their card, and
 * the research period a source covers lives on that connection
 * (`edge.data.period`). Older boards stored spans directly on the timeline
 * (`data.entries`); those still render as rows of their own.
 */

export interface TimelineAxis {
  from: number
  to: number
  /** Number of years shown, inclusive. */
  span: number
  ticks: number[]
}

export interface Period {
  from: number
  to: number
}

function tickStep(span: number): number {
  if (span <= 12) return 1
  if (span <= 30) return 5
  if (span <= 80) return 10
  if (span <= 200) return 25
  return 50
}

type Spanned = { from: number; to: number; year?: string }

export function timelineAxis(
  data: Pick<TimelineNodeData, 'from' | 'to'> & { entries: Spanned[] },
  currentYear = new Date().getFullYear(),
): TimelineAxis {
  const years = data.entries.flatMap((entry) => {
    const published = Number.parseInt(entry.year ?? '', 10)
    return [entry.from, entry.to, ...(Number.isFinite(published) ? [published] : [])]
  })
  let from = data.from ?? (years.length ? Math.min(...years) - 1 : currentYear - 20)
  let to = data.to ?? (years.length ? Math.max(...years) + 1 : currentYear)
  if (to < from) [from, to] = [to, from]
  const span = to - from + 1
  const step = tickStep(span)
  const ticks: number[] = []
  for (let year = Math.ceil(from / step) * step; year <= to; year += step) ticks.push(year)
  return { from, to, span, ticks }
}

/** Left offset and width in percent of the track for a span of years. */
export function spanPercent(axis: TimelineAxis, from: number, to: number): { left: number; width: number } {
  const start = Math.max(Math.min(from, to), axis.from)
  const end = Math.min(Math.max(from, to), axis.to)
  if (end < start) return { left: 0, width: 0 }
  return {
    left: ((start - axis.from) / axis.span) * 100,
    width: ((end - start + 1) / axis.span) * 100,
  }
}

/** Middle of a year cell, in percent — where a publication marker sits. */
export function yearPercent(axis: TimelineAxis, year: number): number {
  return ((year - axis.from + 0.5) / axis.span) * 100
}

export function clampYear(value: number): number {
  return Math.min(Math.max(Math.round(value), 1000), 3000)
}

/** Applies a drag of `deltaYears` to the edge(s) that were grabbed. */
export function dragEntry(entry: Period, grip: 'start' | 'end' | 'body', deltaYears: number): Period {
  const delta = Math.round(deltaYears)
  if (grip === 'body') return { from: clampYear(entry.from + delta), to: clampYear(entry.to + delta) }
  if (grip === 'start') return { from: clampYear(Math.min(entry.from + delta, entry.to)), to: entry.to }
  return { from: entry.from, to: clampYear(Math.max(entry.to + delta, entry.from)) }
}

export function sortEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => a.from - b.from || a.to - b.to || a.title.localeCompare(b.title))
}

/** Publication year of a card: its own for sources, the source's for quotes. */
export function publicationYear(node: MindNode, byId: Map<string, MindNode>): string | undefined {
  if (node.type === 'zoteroItem') return (node.data as ItemNodeData).snapshot.year || undefined
  if (node.type === 'note' && node.data.itemKey) {
    const source = byId.get(`item:${node.data.itemKey}`)
    if (source?.type === 'zoteroItem') return (source.data as ItemNodeData).snapshot.year || undefined
    const year = /\b(1[5-9]\d\d|20\d\d)\b/.exec(node.data.citation ?? '')?.[1]
    return year
  }
  return undefined
}

/** Starting period for a newly linked source: the five years up to publication. */
export function defaultPeriod(year: string | undefined, currentYear = new Date().getFullYear()): Period {
  const parsed = Number.parseInt(year ?? '', 10)
  const anchor = Number.isFinite(parsed) ? parsed : currentYear
  return { from: anchor - 5, to: anchor }
}

export interface TimelineRow {
  key: string
  kind: 'link' | 'entry'
  /** The connection carrying the period (links only). */
  edgeId?: string
  /** The stored span (entries only). */
  entryId?: string
  /** The card this row stands for (links only). */
  nodeId?: string
  title: string
  subtitle?: string
  year?: string
  from: number
  to: number
  note?: string
  accent?: Accent
}

function subtitleFor(node: MindNode): string | undefined {
  if (node.type === 'zoteroItem') return (node.data as ItemNodeData).snapshot.creatorSummary || undefined
  if (node.type === 'note') return node.data.citation
  return undefined
}

function titleFor(node: MindNode): string {
  if (node.type === 'note' && node.data.citation) return node.data.text.replace(/\s+/g, ' ').trim() || node.data.citation
  return cardLabel(node)
}

/** One Gantt row per linked card, plus rows for spans stored on older timelines. */
export function timelineRows(
  timelineId: string,
  nodes: MindNode[],
  edges: MindEdge[],
  entries: TimelineEntry[],
): TimelineRow[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const rows: TimelineRow[] = []
  const linkedItems = new Set<string>()
  const seenNodes = new Set<string>()

  for (const edge of edges) {
    if (edge.data?.derived) continue
    const otherId = edge.source === timelineId ? edge.target : edge.target === timelineId ? edge.source : null
    if (!otherId || seenNodes.has(otherId)) continue
    const other = byId.get(otherId)
    if (!other || other.type === 'timeline' || other.type === 'frame') continue
    seenNodes.add(otherId)
    const year = publicationYear(other, byId)
    const period = edge.data?.period ?? defaultPeriod(year)
    if (other.type === 'zoteroItem') linkedItems.add((other.data as ItemNodeData).itemKey)
    rows.push({
      key: `link:${edge.id}`,
      kind: 'link',
      edgeId: edge.id,
      nodeId: other.id,
      title: titleFor(other),
      subtitle: subtitleFor(other),
      year,
      from: Math.min(period.from, period.to),
      to: Math.max(period.from, period.to),
      note: edge.data?.note,
      accent: edge.data?.accent,
    })
  }

  for (const entry of entries) {
    if (entry.itemKey && linkedItems.has(entry.itemKey)) continue
    rows.push({
      key: `entry:${entry.id}`,
      kind: 'entry',
      entryId: entry.id,
      title: entry.title,
      subtitle: entry.creatorSummary,
      year: entry.year,
      from: entry.from,
      to: entry.to,
      note: entry.note,
      accent: entry.accent,
    })
  }

  return rows.sort((a, b) => a.from - b.from || a.to - b.to || a.title.localeCompare(b.title))
}

/** How many sources cover each year of the axis — shows well- and under-researched periods. */
export function yearCoverage(rows: Period[], axis: TimelineAxis): number[] {
  const counts = Array.from({ length: axis.span }, () => 0)
  for (const row of rows) {
    for (let year = Math.max(row.from, axis.from); year <= Math.min(row.to, axis.to); year += 1) {
      counts[year - axis.from]! += 1
    }
  }
  return counts
}
