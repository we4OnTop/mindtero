/**
 * Typed relations between nodes.
 *
 * Colour is validated, but it is never the only encoding: every edge also carries a
 * dash pattern, an arrowhead style and a visible label chip, and the toolbar shows a
 * permanent legend. On a dense canvas all edge colours are visible at once (the
 * "all pairs" case), which caps how many hues can be told apart — so only three
 * structural kinds take categorical hues (validated all-pairs, light and dark),
 * `supports`/`contradicts` use reserved status colours, and the rest stay neutral ink.
 *
 * Hex values live in `src/index.css` as `--rel-*` custom properties so the light and
 * dark variants swap without a React re-render.
 */

export const RELATION_KINDS = [
  'related',
  'cites',
  'supports',
  'contradicts',
  'extends',
  'method',
  'context',
] as const

export type RelationKind = (typeof RELATION_KINDS)[number]

export interface RelationSpec {
  kind: RelationKind
  label: string
  /** Shown in pickers and the legend. */
  description: string
  /** CSS custom property holding the stroke colour. */
  color: string
  strokeWidth: number
  /** SVG dash array; empty string means solid. */
  dash: string
  marker: 'arrow' | 'arrowclosed' | 'none'
  /** Reads well as "A <verb> B". */
  verb: string
}

export const RELATIONS: Record<RelationKind, RelationSpec> = {
  related: {
    kind: 'related',
    label: 'Related',
    description: 'Unspecified association — the default, and what Zotero itself stores.',
    color: 'var(--rel-related)',
    strokeWidth: 1.5,
    dash: '',
    marker: 'none',
    verb: 'is related to',
  },
  cites: {
    kind: 'cites',
    label: 'Cites',
    description: 'A references B.',
    color: 'var(--rel-cites)',
    strokeWidth: 1.5,
    dash: '',
    marker: 'arrowclosed',
    verb: 'cites',
  },
  supports: {
    kind: 'supports',
    label: 'Supports',
    description: 'A provides evidence for B.',
    color: 'var(--rel-supports)',
    strokeWidth: 2,
    dash: '',
    marker: 'arrowclosed',
    verb: 'supports',
  },
  contradicts: {
    kind: 'contradicts',
    label: 'Contradicts',
    description: 'A argues against or fails to replicate B.',
    color: 'var(--rel-contradicts)',
    strokeWidth: 2,
    dash: '6 4',
    marker: 'arrowclosed',
    verb: 'contradicts',
  },
  extends: {
    kind: 'extends',
    label: 'Extends',
    description: 'A builds on and develops B.',
    color: 'var(--rel-extends)',
    strokeWidth: 2,
    dash: '',
    marker: 'arrowclosed',
    verb: 'extends',
  },
  method: {
    kind: 'method',
    label: 'Method',
    description: 'A applies a method or instrument from B.',
    color: 'var(--rel-method)',
    strokeWidth: 2,
    dash: '8 3 2 3',
    marker: 'arrow',
    verb: 'uses the method of',
  },
  context: {
    kind: 'context',
    label: 'Context',
    description: 'Background, definition or framing.',
    color: 'var(--rel-context)',
    strokeWidth: 1.5,
    dash: '2 4',
    marker: 'none',
    verb: 'gives context for',
  },
}

export const DEFAULT_RELATION: RelationKind = 'related'

export function relationSpec(kind: string | undefined): RelationSpec {
  return RELATIONS[(kind ?? DEFAULT_RELATION) as RelationKind] ?? RELATIONS.related
}
