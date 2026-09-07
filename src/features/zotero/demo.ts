import { formatReference, itemTitle, creatorSummary, itemYear } from './format'
import type { ZoteroSource } from './source'
import type {
  ZoteroCollection,
  ZoteroConnectionInfo,
  ZoteroCreator,
  ZoteroItem,
  ZoteroItemData,
  ZoteroItemQuery,
  ZoteroLibraryRef,
  ZoteroPage,
  ZoteroSavedSearch,
  ZoteroTag,
} from './types'

/**
 * A small fixture library so the whole app is explorable with Zotero closed:
 * useful for UI work, demos and tests. Shaped exactly like real API payloads.
 */

const LIBRARY: ZoteroLibraryRef = { type: 'user', id: 0 }
const LIBRARY_INFO = { type: 'user', id: 0, name: 'Demo Library' }
const URI_BASE = 'http://zotero.org/users/local/demo'

function creators(spec: string): ZoteroCreator[] {
  return spec
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [last, first] = entry.split(',').map((part) => part.trim())
      return { creatorType: 'author', lastName: last ?? entry, firstName: first ?? '' }
    })
}

interface ItemSpec {
  key: string
  itemType: string
  title: string
  authors: string
  date: string
  container?: string
  abstract?: string
  tags?: string[]
  collections?: string[]
  related?: string[]
  doi?: string
  url?: string
  extra?: Record<string, string>
}

function makeItem(spec: ItemSpec, index: number): ZoteroItem {
  const data: ZoteroItemData = {
    key: spec.key,
    version: 100 + index,
    itemType: spec.itemType,
    title: spec.title,
    creators: creators(spec.authors),
    abstractNote: spec.abstract ?? '',
    date: spec.date,
    publicationTitle: spec.container ?? '',
    DOI: spec.doi ?? '',
    url: spec.url ?? '',
    tags: (spec.tags ?? []).map((tag) => ({ tag, type: 1 as const })),
    collections: spec.collections ?? [],
    relations: spec.related?.length
      ? { 'dc:relation': spec.related.map((key) => `${URI_BASE}/items/${key}`) }
      : {},
    dateAdded: `2024-0${(index % 9) + 1}-1${index % 9}T09:00:00Z`,
    dateModified: `2025-0${(index % 9) + 1}-1${index % 9}T09:00:00Z`,
    ...spec.extra,
  }

  return {
    key: spec.key,
    version: data.version,
    library: LIBRARY_INFO,
    links: {},
    meta: {
      creatorSummary: '',
      parsedDate: spec.date,
      numChildren: 0,
    },
    data,
  }
}

const COLLECTION_SPECS: Array<{ key: string; name: string; parent?: string }> = [
  { key: 'COLLFND1', name: 'Foundations' },
  { key: 'COLLMTH1', name: 'Methods' },
  { key: 'COLLTLS1', name: 'Tools & Systems' },
  { key: 'COLLCRT1', name: 'Critiques' },
  { key: 'COLLGRF1', name: 'Graph Layout', parent: 'COLLTLS1' },
]

const ITEM_SPECS: ItemSpec[] = [
  {
    key: 'BUSH1945',
    itemType: 'magazineArticle',
    title: 'As We May Think',
    authors: 'Bush, Vannevar',
    date: '1945-07',
    container: 'The Atlantic Monthly',
    abstract:
      'Proposes the memex, a desk-sized device for storing and associatively linking documents. The origin point for associative trails as a knowledge practice.',
    tags: ['hypertext', 'foundational', 'memex'],
    collections: ['COLLFND1'],
    related: ['NELS1965', 'ENGL1962'],
  },
  {
    key: 'ENGL1962',
    itemType: 'report',
    title: 'Augmenting Human Intellect: A Conceptual Framework',
    authors: 'Engelbart, Douglas C.',
    date: '1962',
    container: 'Stanford Research Institute',
    abstract:
      'A framework for increasing the capability of humans to approach complex problem situations, gain comprehension and derive solutions.',
    tags: ['foundational', 'augmentation', 'hci'],
    collections: ['COLLFND1'],
    related: ['BUSH1945', 'NELS1965'],
  },
  {
    key: 'NELS1965',
    itemType: 'conferencePaper',
    title: 'A File Structure for the Complex, the Changing and the Indeterminate',
    authors: 'Nelson, Theodor H.',
    date: '1965',
    container: 'ACM National Conference',
    abstract:
      'Introduces hypertext and zippered lists: documents that hold their own history of change and arbitrary links between fragments.',
    tags: ['hypertext', 'foundational'],
    collections: ['COLLFND1'],
    related: ['BUSH1945', 'ENGL1962'],
    doi: '10.1145/800197.806036',
  },
  {
    key: 'RUSS1993',
    itemType: 'conferencePaper',
    title: 'The Cost Structure of Sensemaking',
    authors: 'Russell, Daniel M.; Stefik, Mark J.; Pirolli, Peter; Card, Stuart K.',
    date: '1993',
    container: 'INTERCHI',
    abstract:
      'Models sensemaking as a search for a representation that minimises the cost of task-specific information processing.',
    tags: ['sensemaking', 'foundational', 'cognition'],
    collections: ['COLLFND1', 'COLLMTH1'],
    related: ['PIRO2005', 'KLEI2006'],
    doi: '10.1145/169059.169209',
  },
  {
    key: 'PIRO2005',
    itemType: 'conferencePaper',
    title: 'The Sensemaking Process and Leverage Points for Analyst Technology',
    authors: 'Pirolli, Peter; Card, Stuart K.',
    date: '2005',
    container: 'International Conference on Intelligence Analysis',
    abstract:
      'Describes the foraging and sensemaking loops of intelligence analysis and where tools can intervene.',
    tags: ['sensemaking', 'information foraging', 'analysis'],
    collections: ['COLLFND1', 'COLLMTH1'],
    related: ['RUSS1993'],
  },
  {
    key: 'KLEI2006',
    itemType: 'journalArticle',
    title: 'Making Sense of Sensemaking 1: Alternative Perspectives',
    authors: 'Klein, Gary; Moon, Brian; Hoffman, Robert R.',
    date: '2006',
    container: 'IEEE Intelligent Systems',
    abstract:
      'Reviews competing accounts of sensemaking and argues for a data-frame theory in which frames shape which data count as relevant.',
    tags: ['sensemaking', 'cognition'],
    collections: ['COLLFND1'],
    related: ['RUSS1993'],
    doi: '10.1109/MIS.2006.75',
  },
  {
    key: 'SHNE1996',
    itemType: 'conferencePaper',
    title: 'The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations',
    authors: 'Shneiderman, Ben',
    date: '1996',
    container: 'IEEE Symposium on Visual Languages',
    abstract:
      'Overview first, zoom and filter, then details on demand — the visual information seeking mantra, with a taxonomy covering network data.',
    tags: ['visualization', 'foundational', 'interaction'],
    collections: ['COLLTLS1'],
    related: ['HEER2010', 'VANH2009'],
    doi: '10.1109/VL.1996.545307',
  },
  {
    key: 'HEER2010',
    itemType: 'journalArticle',
    title: 'A Tour Through the Visualization Zoo',
    authors: 'Heer, Jeffrey; Bostock, Michael; Ogievetsky, Vadim',
    date: '2010',
    container: 'Communications of the ACM',
    abstract:
      'A survey of visualization techniques including node-link diagrams, adjacency matrices and hierarchical layouts.',
    tags: ['visualization', 'survey'],
    collections: ['COLLTLS1'],
    related: ['SHNE1996', 'VANH2009'],
    doi: '10.1145/1743546.1743567',
  },
  {
    key: 'VANH2009',
    itemType: 'conferencePaper',
    title: 'Search, Show Context, Expand on Demand: Supporting Large Graph Exploration',
    authors: 'van Ham, Frank; Perer, Adam',
    date: '2009',
    container: 'IEEE InfoVis',
    abstract:
      'Argues against overview-first for large graphs: start from a query result and grow the neighbourhood on demand using degree-of-interest.',
    tags: ['graph', 'visualization', 'interaction', 'degree-of-interest'],
    collections: ['COLLTLS1', 'COLLGRF1'],
    related: ['SHNE1996', 'HEER2010', 'FURN1986'],
    doi: '10.1109/TVCG.2009.108',
  },
  {
    key: 'FURN1986',
    itemType: 'conferencePaper',
    title: 'Generalized Fisheye Views',
    authors: 'Furnas, George W.',
    date: '1986',
    container: 'CHI',
    abstract:
      'A degree-of-interest function balancing a priori importance against distance from the current focus.',
    tags: ['degree-of-interest', 'foundational', 'interaction'],
    collections: ['COLLGRF1'],
    related: ['VANH2009'],
    doi: '10.1145/22627.22342',
  },
  {
    key: 'SUGI1981',
    itemType: 'journalArticle',
    title: 'Methods for Visual Understanding of Hierarchical System Structures',
    authors: 'Sugiyama, Kozo; Tagawa, Shojiro; Toda, Mitsuhiko',
    date: '1981',
    container: 'IEEE Transactions on Systems, Man, and Cybernetics',
    abstract:
      'The layered graph drawing method behind dagre and most left-to-right diagram layouts.',
    tags: ['graph', 'layout', 'algorithm'],
    collections: ['COLLGRF1'],
    related: ['FRUC1991'],
    doi: '10.1109/TSMC.1981.4308636',
  },
  {
    key: 'FRUC1991',
    itemType: 'journalArticle',
    title: 'Graph Drawing by Force-Directed Placement',
    authors: 'Fruchterman, Thomas M. J.; Reingold, Edward M.',
    date: '1991',
    container: 'Software: Practice and Experience',
    abstract:
      'The spring-electrical model used by most force layouts, including the ones in modern graph UIs.',
    tags: ['graph', 'layout', 'algorithm'],
    collections: ['COLLGRF1'],
    related: ['SUGI1981'],
    doi: '10.1002/spe.4380211102',
  },
  {
    key: 'SMAL1973',
    itemType: 'journalArticle',
    title: 'Co-citation in the Scientific Literature',
    authors: 'Small, Henry',
    date: '1973',
    container: 'Journal of the American Society for Information Science',
    abstract:
      'Defines co-citation as a measure of subject similarity between documents, the basis of most citation-network maps.',
    tags: ['bibliometrics', 'citation network', 'foundational'],
    collections: ['COLLMTH1'],
    related: ['CHEN2006', 'WALT2020'],
    doi: '10.1002/asi.4630240406',
  },
  {
    key: 'CHEN2006',
    itemType: 'journalArticle',
    title: 'CiteSpace II: Detecting and Visualizing Emerging Trends in Scientific Literature',
    authors: 'Chen, Chaomei',
    date: '2006',
    container: 'Journal of the American Society for Information Science and Technology',
    abstract:
      'A system for progressive knowledge domain visualization built on time-sliced co-citation networks.',
    tags: ['bibliometrics', 'citation network', 'tools'],
    collections: ['COLLMTH1', 'COLLTLS1'],
    related: ['SMAL1973', 'WALT2020'],
    doi: '10.1002/asi.20317',
  },
  {
    key: 'WALT2020',
    itemType: 'journalArticle',
    title: 'Citation-Based Clustering of Publications Using CitNetExplorer and VOSviewer',
    authors: 'van Eck, Nees Jan; Waltman, Ludo',
    date: '2017',
    container: 'Scientometrics',
    abstract:
      'Compares direct-citation, co-citation and bibliographic-coupling clustering across two widely used tools.',
    tags: ['bibliometrics', 'citation network', 'tools', 'methods'],
    collections: ['COLLMTH1'],
    related: ['SMAL1973', 'CHEN2006'],
    doi: '10.1007/s11192-017-2300-7',
  },
  {
    key: 'AHRE2017',
    itemType: 'book',
    title: 'How to Take Smart Notes',
    authors: 'Ahrens, Sönke',
    date: '2017',
    container: 'CreateSpace',
    abstract:
      'A popular account of the Zettelkasten method: atomic notes, explicit links between them, and writing as the by-product of linking.',
    tags: ['zettelkasten', 'note-taking', 'practice'],
    collections: ['COLLMTH1'],
    related: ['SCHM2018'],
  },
  {
    key: 'SCHM2018',
    itemType: 'journalArticle',
    title: 'Niklas Luhmann’s Card Index: The Fabrication of Serendipity',
    authors: 'Schmidt, Johannes F. K.',
    date: '2018',
    container: 'Sociologica',
    abstract:
      'A historical study of Luhmann’s Zettelkasten showing how its link structure, not its content, produced its generativity.',
    tags: ['zettelkasten', 'history', 'note-taking'],
    collections: ['COLLMTH1'],
    related: ['AHRE2017'],
    doi: '10.6092/issn.1971-8853/8350',
  },
  {
    key: 'MUNZ2014',
    itemType: 'book',
    title: 'Visualization Analysis and Design',
    authors: 'Munzner, Tamara',
    date: '2014',
    container: 'CRC Press',
    abstract:
      'A what–why–how framework for validating visual encoding and interaction choices, with a chapter on network layouts.',
    tags: ['visualization', 'design', 'textbook'],
    collections: ['COLLTLS1'],
    related: ['HEER2010', 'SHNE1996'],
  },
  {
    key: 'BORG2011',
    itemType: 'journalArticle',
    title: 'The Conduit Metaphor and the Limits of Citation Counting',
    authors: 'Borgman, Christine L.',
    date: '2011',
    container: 'Journal of Documentation',
    abstract:
      'Cautions that citation links encode many different social acts, so treating them as a single relation type discards most of the signal.',
    tags: ['critique', 'bibliometrics', 'citation network'],
    collections: ['COLLCRT1'],
    related: ['SMAL1973', 'MACR1989'],
  },
  {
    key: 'MACR1989',
    itemType: 'journalArticle',
    title: 'Why Do We Cite? Toward a Taxonomy of Citation Motivations',
    authors: 'MacRoberts, Michael H.; MacRoberts, Barbara R.',
    date: '1989',
    container: 'Journal of the American Society for Information Science',
    abstract:
      'Empirical evidence that citations support, contradict, contextualise or merely decorate — motivating typed rather than uniform links.',
    tags: ['critique', 'citation network', 'typed links'],
    collections: ['COLLCRT1'],
    related: ['BORG2011'],
  },
]

const NOTE_SPECS: Array<{ key: string; parent: string; note: string; tags?: string[] }> = [
  {
    key: 'NOTEVH01',
    parent: 'VANH2009',
    note: '<p><strong>Directly applicable.</strong> Their “search, show context, expand on demand” loop is exactly the interaction model for the canvas: never render the whole library, start from a query and grow the neighbourhood one hop at a time.</p>',
    tags: ['design decision'],
  },
  {
    key: 'NOTEMR01',
    parent: 'MACR1989',
    note: '<p>Best argument for <em>typed</em> edges: supports / contradicts / extends / method. A single “related” link throws away the reason the connection exists.</p>',
    tags: ['design decision'],
  },
  {
    key: 'NOTESC01',
    parent: 'SCHM2018',
    note: '<p>Luhmann’s branching numbers are a spatial index, not a taxonomy. Boards play the same role here: many overlapping arrangements of the same items.</p>',
  },
]

const items: ZoteroItem[] = ITEM_SPECS.map(makeItem)

const notes: ZoteroItem[] = NOTE_SPECS.map((spec, index) => ({
  key: spec.key,
  version: 300 + index,
  library: LIBRARY_INFO,
  links: {},
  meta: {},
  data: {
    key: spec.key,
    version: 300 + index,
    itemType: 'note',
    parentItem: spec.parent,
    note: spec.note,
    tags: (spec.tags ?? []).map((tag) => ({ tag, type: 0 as const })),
    collections: [],
    relations: {},
    dateAdded: '2025-02-01T10:00:00Z',
    dateModified: '2025-02-01T10:00:00Z',
  },
}))

for (const note of notes) {
  const parent = items.find((item) => item.key === note.data.parentItem)
  if (parent) parent.meta.numChildren = (parent.meta.numChildren ?? 0) + 1
}

const collections: ZoteroCollection[] = COLLECTION_SPECS.map((spec, index) => ({
  key: spec.key,
  version: 10 + index,
  library: LIBRARY_INFO,
  links: {},
  meta: {
    numCollections: COLLECTION_SPECS.filter((c) => c.parent === spec.key).length,
    numItems: items.filter((item) => (item.data.collections ?? []).includes(spec.key)).length,
  },
  data: {
    key: spec.key,
    version: 10 + index,
    name: spec.name,
    parentCollection: spec.parent ?? false,
    relations: {},
  },
}))

const allItems = [...items, ...notes]

function matchesQuery(item: ZoteroItem, q: string): boolean {
  const haystack = [
    itemTitle(item),
    creatorSummary(item),
    itemYear(item),
    String(item.data.abstractNote ?? ''),
    (item.data.tags ?? []).map((t) => t.tag).join(' '),
  ]
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token))
}

function matchesTag(item: ZoteroItem, tag: string | string[]): boolean {
  const wanted = Array.isArray(tag) ? tag : [tag]
  const own = new Set((item.data.tags ?? []).map((t) => t.tag))
  return wanted.every((entry) => entry.split('||').some((part) => own.has(part.trim())))
}

/** In-memory implementation of the subset of query semantics the UI relies on. */
export class DemoSource implements ZoteroSource {
  readonly id = 'demo' as const
  readonly library = LIBRARY

  async ping(): Promise<ZoteroConnectionInfo> {
    return { ok: true, source: 'demo', itemCount: items.length }
  }

  async getCollections(): Promise<ZoteroCollection[]> {
    return collections
  }

  async getItems(query: ZoteroItemQuery): Promise<ZoteroPage<ZoteroItem>> {
    const { collectionKey, top = true, q, tag, limit = 50, start = 0, sort, direction } = query
    let result = top ? [...items] : [...allItems]
    if (collectionKey) {
      result = result.filter((item) => (item.data.collections ?? []).includes(collectionKey))
    }
    if (q) result = result.filter((item) => matchesQuery(item, q))
    if (tag) result = result.filter((item) => matchesTag(item, tag))

    const sortKey = sort ?? 'title'
    result.sort((a, b) => {
      const pick = (item: ZoteroItem) => {
        switch (sortKey) {
          case 'date':
            return itemYear(item)
          case 'creator':
            return creatorSummary(item)
          case 'itemType':
            return item.data.itemType
          case 'dateAdded':
            return String(item.data.dateAdded)
          case 'dateModified':
            return String(item.data.dateModified)
          default:
            return itemTitle(item)
        }
      }
      return pick(a).localeCompare(pick(b)) * (direction === 'desc' ? -1 : 1)
    })

    return {
      items: result.slice(start, start + limit),
      totalResults: result.length,
      version: 1,
      start,
      limit,
    }
  }

  async getItem(key: string): Promise<ZoteroItem> {
    const found = allItems.find((item) => item.key === key)
    if (!found) throw new Error(`Demo library has no item ${key}`)
    return found
  }

  async getChildren(key: string): Promise<ZoteroItem[]> {
    return notes.filter((note) => note.data.parentItem === key)
  }

  async getItemsByKeys(keys: string[]): Promise<ZoteroItem[]> {
    return keys
      .map((key) => allItems.find((item) => item.key === key))
      .filter((item): item is ZoteroItem => Boolean(item))
  }

  async getTags(): Promise<ZoteroTag[]> {
    const counts = new Map<string, number>()
    for (const item of allItems) {
      for (const { tag } of item.data.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, numItems]) => ({ tag, links: {}, meta: { type: 1, numItems } }))
  }

  async getSavedSearches(): Promise<ZoteroSavedSearch[]> {
    return []
  }

  async getBibliography(keys: string[]): Promise<string[]> {
    const found = await this.getItemsByKeys(keys)
    return found.map((item) => `<div class="csl-entry">${formatReference(item)}</div>`)
  }
}

export const demoLibrary = { items, notes, collections }
