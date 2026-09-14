import { describe, expect, it } from 'vitest'
import {
  defaultPeriod,
  dragEntry,
  publicationYear,
  sortEntries,
  spanPercent,
  timelineAxis,
  timelineRows,
  yearCoverage,
  yearPercent,
} from './timeline'
import type { MindEdge, MindNode, TimelineEntry } from './types'

const entry = (id: string, from: number, to: number, year?: string, itemKey?: string): TimelineEntry => ({
  id,
  title: id,
  from,
  to,
  year,
  itemKey,
})

const item = (key: string, title: string, year: string): MindNode => ({
  id: `item:${key}`,
  type: 'zoteroItem',
  position: { x: 0, y: 0 },
  data: { itemKey: key, snapshot: { key, title, creatorSummary: 'Doe', year, itemType: 'book' } },
})

const timeline: MindNode = {
  id: 'timeline:1',
  type: 'timeline',
  position: { x: 0, y: 0 },
  data: { label: 'Research timeline', entries: [] },
}

const link = (id: string, target: string, period?: { from: number; to: number }, reversed = false): MindEdge => ({
  id,
  source: reversed ? target : timeline.id,
  target: reversed ? timeline.id : target,
  type: 'relation',
  data: { kind: 'context', period },
})

describe('timelineAxis', () => {
  it('derives bounds from spans and publication years with a year of margin', () => {
    const axis = timelineAxis({ entries: [entry('a', 2015, 2020, '2023'), entry('b', 2010, 2012)] })
    expect(axis).toMatchObject({ from: 2009, to: 2024, span: 16 })
    expect(axis.ticks).toEqual([2010, 2015, 2020])
  })

  it('respects explicit bounds and falls back to the last twenty years', () => {
    expect(timelineAxis({ from: 1990, to: 2000, entries: [] })).toMatchObject({ from: 1990, to: 2000, span: 11 })
    expect(timelineAxis({ entries: [] }, 2026)).toMatchObject({ from: 2006, to: 2026 })
  })

  it('swaps reversed bounds', () => {
    expect(timelineAxis({ from: 2020, to: 2010, entries: [] })).toMatchObject({ from: 2010, to: 2020 })
  })
})

describe('spanPercent', () => {
  const axis = timelineAxis({ from: 2000, to: 2009, entries: [] })
  it('maps inclusive year spans onto the track', () => {
    expect(spanPercent(axis, 2000, 2009)).toEqual({ left: 0, width: 100 })
    expect(spanPercent(axis, 2005, 2005)).toEqual({ left: 50, width: 10 })
  })
  it('clips spans that leave the axis', () => {
    expect(spanPercent(axis, 1990, 2001)).toEqual({ left: 0, width: 20 })
    expect(spanPercent(axis, 2020, 2030).width).toBe(0)
  })
  it('centres publication markers in their year', () => {
    expect(yearPercent(axis, 2000)).toBe(5)
  })
})

describe('dragEntry', () => {
  it('moves, stretches and never inverts a span', () => {
    expect(dragEntry({ from: 2010, to: 2015 }, 'body', 2.4)).toEqual({ from: 2012, to: 2017 })
    expect(dragEntry({ from: 2010, to: 2015 }, 'start', -3)).toEqual({ from: 2007, to: 2015 })
    expect(dragEntry({ from: 2010, to: 2015 }, 'start', 9)).toEqual({ from: 2015, to: 2015 })
    expect(dragEntry({ from: 2010, to: 2015 }, 'end', -9)).toEqual({ from: 2010, to: 2010 })
  })
})

describe('sortEntries', () => {
  it('orders by start, then end', () => {
    expect(sortEntries([entry('c', 2012, 2014), entry('a', 2010, 2020), entry('b', 2010, 2011)]).map((e) => e.id)).toEqual([
      'b',
      'a',
      'c',
    ])
  })
})

describe('timelineRows', () => {
  const book = item('BOOK0001', 'Requirements Engineering', '2019')
  const paper = item('PAPER001', 'GenAI for RE', '2026')
  const quote: MindNode = {
    id: 'note:q',
    type: 'note',
    position: { x: 0, y: 0 },
    data: { text: 'Since 2023 publications grew.', citation: 'Cheng et al., 2026, p. 153', itemKey: 'PAPER001' },
  }
  const nodes = [timeline, book, paper, quote]

  it('turns every connection to the timeline into a Gantt row, in either direction', () => {
    const rows = timelineRows(
      timeline.id,
      nodes,
      [link('e1', book.id, { from: 2010, to: 2019 }), link('e2', paper.id, { from: 2015, to: 2012 }, true)],
      [],
    )
    expect(rows.map((row) => [row.nodeId, row.from, row.to, row.edgeId])).toEqual([
      // Overlapping periods in the same years each keep their own row.
      ['item:BOOK0001', 2010, 2019, 'e1'],
      ['item:PAPER001', 2012, 2015, 'e2'],
    ])
    expect(rows[0]).toMatchObject({ kind: 'link', title: 'Requirements Engineering', subtitle: 'Doe', year: '2019' })
  })

  it('falls back to the five years before publication, using the source year for quotes', () => {
    const rows = timelineRows(timeline.id, nodes, [link('e3', quote.id)], [])
    expect(rows[0]).toMatchObject({ from: 2021, to: 2026, year: '2026', subtitle: 'Cheng et al., 2026, p. 153' })
    expect(publicationYear(quote, new Map(nodes.map((node) => [node.id, node])))).toBe('2026')
    expect(defaultPeriod(undefined, 2026)).toEqual({ from: 2021, to: 2026 })
  })

  it('keeps spans stored by older timelines unless the same source is now linked', () => {
    const stored = [entry('old', 2000, 2005, '2006', 'BOOK0001'), entry('legacy', 1990, 1995)]
    const rows = timelineRows(timeline.id, nodes, [link('e1', book.id, { from: 2010, to: 2019 })], stored)
    expect(rows.map((row) => row.key)).toEqual(['entry:legacy', 'link:e1'])
  })

  it('ignores unrelated connections and a second line to the same card', () => {
    const rows = timelineRows(
      timeline.id,
      nodes,
      [
        link('e1', book.id, { from: 2010, to: 2019 }),
        link('dup', book.id, { from: 2000, to: 2001 }),
        { id: 'x', source: book.id, target: paper.id, type: 'relation', data: { kind: 'related' } },
      ],
      [],
    )
    expect(rows).toHaveLength(1)
  })
})

describe('yearCoverage', () => {
  it('counts overlapping sources per year', () => {
    const axis = timelineAxis({ from: 2010, to: 2019, entries: [] })
    const counts = yearCoverage([{ from: 2012, to: 2015 }, { from: 2010, to: 2019 }], axis)
    expect(counts).toEqual([1, 1, 2, 2, 2, 2, 1, 1, 1, 1])
  })
})
