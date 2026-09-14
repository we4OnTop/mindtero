import { describe, expect, it } from 'vitest'
import { claimEvidence, findGaps, questionScope } from './argument'
import { inheritedTags, parseQuery, searchBoard, searchEntries, tagCounts } from './board-search'
import type { MindEdge, MindNode } from './types'
import type { RelationKind } from './relations'

const claim = (id: string, text = id): MindNode => ({ id, type: 'claim', position: { x: 0, y: 0 }, data: { text }, width: 200, height: 80 })
const question = (id: string, code: string): MindNode => ({
  id,
  type: 'question',
  position: { x: 0, y: 0 },
  data: { code, text: `What about ${code}?` },
  width: 200,
  height: 80,
})
const quote = (id: string, text: string, x = 0, y = 0): MindNode => ({
  id,
  type: 'note',
  position: { x, y },
  data: { text, citation: 'Cheng et al., 2026, p. 142', itemKey: 'WMC6TAM4' },
  width: 200,
  height: 80,
})
const item = (key: string, title: string, tags: string[] = []): MindNode => ({
  id: `item:${key}`,
  type: 'zoteroItem',
  position: { x: 5000, y: 5000 },
  data: { itemKey: key, snapshot: { key, title, creatorSummary: 'Cheng et al.', year: '2026', itemType: 'journalArticle', tags } },
  width: 268,
  height: 132,
})
const frame = (id: string, x: number, y: number, size: number, data: Record<string, unknown> = {}): MindNode => ({
  id,
  type: 'frame',
  position: { x, y },
  data: { label: id, ...data },
  width: size,
  height: size,
})
const edge = (source: string, target: string, kind: RelationKind = 'related', label?: string): MindEdge => ({
  id: `${source}->${target}:${kind}`,
  source,
  target,
  type: 'relation',
  data: { kind, label },
})

describe('claimEvidence', () => {
  const nodes = [claim('c1'), claim('c2'), quote('q1', 'a'), quote('q2', 'b'), quote('q3', 'c')]

  it('counts supports and contradicts in either drawing direction', () => {
    const evidence = claimEvidence('c1', nodes, [
      edge('q1', 'c1', 'supports'),
      edge('c1', 'q2', 'supports'),
      edge('q3', 'c1', 'contradicts'),
      edge('q1', 'c1', 'related'),
    ])
    expect(evidence.supporting.map((node) => node.id).sort()).toEqual(['q1', 'q2'])
    expect(evidence.contradicting.map((node) => node.id)).toEqual(['q3'])
    expect(evidence.status).toBe('contested')
  })

  it('treats "claim supports claim" as evidence for the target only', () => {
    const edges = [edge('c2', 'c1', 'supports')]
    expect(claimEvidence('c1', nodes, edges).supporting.map((node) => node.id)).toEqual(['c2'])
    expect(claimEvidence('c2', nodes, edges).status).toBe('unsupported')
  })
})

describe('questionScope', () => {
  it('follows connections, stops at other questions and brings frame contents along', () => {
    const nodes = [
      question('rq1', 'RQ1'),
      question('rq2', 'RQ2'),
      claim('c1'),
      quote('q1', 'a'),
      frame('f1', 1000, 1000, 400),
      quote('inside', 'b', 1100, 1100),
      claim('other'),
    ]
    const scope = questionScope('rq1', nodes, [
      edge('rq1', 'c1'),
      edge('q1', 'c1', 'supports'),
      edge('c1', 'rq2'),
      edge('rq2', 'other'),
      edge('rq1', 'f1'),
    ])
    expect([...scope].sort()).toEqual(['c1', 'f1', 'inside', 'q1'])
  })
})

describe('findGaps', () => {
  it('flags unsupported claims, empty questions and unused sources', () => {
    const nodes = [question('rq1', 'RQ1'), claim('c1'), claim('c2'), quote('q1', 'a'), item('WMC6TAM4', 'Paper'), item('LONELY01', 'Unused')]
    const gaps = findGaps(nodes, [
      edge('q1', 'c1', 'supports'),
      edge('item:WMC6TAM4', 'q1', 'context', 'highlight'),
    ])
    const byNode = (id: string) => gaps.filter((gap) => gap.nodeId === id).map((gap) => gap.message)
    expect(byNode('c2')).toContain('Claim has no evidence yet')
    expect(byNode('c1')).toEqual(['Claim is not tied to a research question'])
    expect(byNode('rq1')).toEqual(['Research question has no claims or sources yet'])
    expect(byNode('q1')).toEqual([])
    // Used through its quote.
    expect(byNode('item:WMC6TAM4')).toEqual([])
    expect(byNode('item:LONELY01')).toEqual(['Source is not used in any argument'])
    expect(gaps[0]!.severity).toBe('high')
  })

  it('stays quiet about question anchoring when a board has no questions', () => {
    const gaps = findGaps([claim('c1'), quote('q1', 'a')], [edge('q1', 'c1', 'supports')])
    expect(gaps).toEqual([])
  })
})

describe('tags and search', () => {
  const nodes = [
    frame('se', 0, 0, 1000, { variant: 'tag', tag: 'Software Engineering' }),
    frame('plain', 0, 0, 900),
    quote('q1', 'Requirement changes cause cost overruns', 100, 100),
    { ...quote('q2', 'Généralisation of LLMs', 3000, 3000), data: { text: 'Généralisation of LLMs', tags: ['llm'] } } as MindNode,
    item('WMC6TAM4', 'Generative AI for Requirements Engineering', ['GenAI']),
    { ...claim('c1', 'Frequent requirement changes are the main cost driver'), position: { x: 4000, y: 0 } } as MindNode,
  ]

  it('inherits tags from tag groups only', () => {
    expect(inheritedTags(nodes).get('q1')).toEqual(['Software Engineering'])
    expect(inheritedTags(nodes).has('q2')).toBe(false)
    expect(inheritedTags(nodes).has('plain')).toBe(false)
    expect(tagCounts(nodes).map((entry) => entry.tag)).toContain('Software Engineering')
  })

  it('parses tags, quoted tags and phrases', () => {
    expect(parseQuery('#"software engineering" cost "requirement changes"')).toEqual({
      tags: ['software engineering'],
      terms: ['cost', 'requirement changes'],
    })
  })

  it('finds cards by text, tag and accent-insensitive terms', () => {
    const entries = searchEntries(nodes)
    expect(searchBoard(entries, 'requirement changes').map((hit) => hit.entry.nodeId).sort()).toEqual(['c1', 'q1'])
    // The tag group itself is found too, so the whole group can be located.
    expect(searchBoard(entries, '#software').map((hit) => hit.entry.nodeId).sort()).toEqual(['q1', 'se'])
    expect(searchBoard(entries, '#software cost').map((hit) => hit.entry.nodeId)).toEqual(['q1'])
    expect(searchBoard(entries, 'generalisation').map((hit) => hit.entry.nodeId)).toEqual(['q2'])
    expect(searchBoard(entries, '#genai').map((hit) => hit.entry.nodeId)).toEqual(['item:WMC6TAM4'])
    expect(searchBoard(entries, '   ')).toEqual([])
  })

  it('ranks title hits first', () => {
    const hits = searchBoard(searchEntries(nodes), 'requirements')
    expect(hits[0]!.entry.nodeId).toBe('item:WMC6TAM4')
  })
})
