/**
 * Shapes returned by the Zotero Web API v3, which the Zotero 7 local HTTP API
 * mirrors (read-only) at http://localhost:23119/api.
 * @see https://www.zotero.org/support/dev/web_api/v3/basics
 */

export type ZoteroLibraryType = 'user' | 'group'

export interface ZoteroLibraryRef {
  type: ZoteroLibraryType
  /** Always 0 for the local API's user library. */
  id: number
}

export interface ZoteroCreator {
  creatorType: string
  firstName?: string
  lastName?: string
  /** Single-field creators (institutions) use `name` instead of first/last. */
  name?: string
}

export interface ZoteroTagRef {
  tag: string
  /** 0 = manual, 1 = automatic. */
  type?: 0 | 1
}

export interface ZoteroLibraryInfo {
  type: string
  id: number
  name: string
  links?: Record<string, { href: string; type?: string }>
}

export interface ZoteroLinks {
  self?: { href: string; type?: string }
  alternate?: { href: string; type?: string }
  up?: { href: string; type?: string }
  attachment?: { href: string; type?: string; attachmentType?: string; attachmentSize?: number }
}

export interface ZoteroItemData {
  key: string
  version: number
  itemType: string
  title?: string
  creators?: ZoteroCreator[]
  abstractNote?: string
  date?: string
  DOI?: string
  ISBN?: string
  ISSN?: string
  url?: string
  publicationTitle?: string
  journalAbbreviation?: string
  bookTitle?: string
  proceedingsTitle?: string
  publisher?: string
  place?: string
  volume?: string
  issue?: string
  pages?: string
  language?: string
  extra?: string
  shortTitle?: string
  tags?: ZoteroTagRef[]
  collections?: string[]
  /** Predicate → item URI(s), e.g. `{ "dc:relation": ["http://zotero.org/users/local/x/items/ABCD1234"] }`. */
  relations?: Record<string, string | string[]>
  dateAdded: string
  dateModified: string
  /** Present on notes and attachments. */
  parentItem?: string
  note?: string
  filename?: string
  contentType?: string
  linkMode?: string
  /** Item types carry many more optional string fields. */
  [field: string]: unknown
}

export interface ZoteroItemMeta {
  creatorSummary?: string
  parsedDate?: string
  numChildren?: number
}

export interface ZoteroItem {
  key: string
  version: number
  library: ZoteroLibraryInfo
  links: ZoteroLinks
  meta: ZoteroItemMeta
  data: ZoteroItemData
  /** Present when requested with `include=bib`. */
  bib?: string
  /** Present when requested with `include=citation`. */
  citation?: string
}

export interface ZoteroCollectionData {
  key: string
  version: number
  name: string
  /** `false` for top-level collections. */
  parentCollection: string | false
  relations?: Record<string, string | string[]>
}

export interface ZoteroCollection {
  key: string
  version: number
  library: ZoteroLibraryInfo
  links: ZoteroLinks
  meta: { numCollections: number; numItems: number }
  data: ZoteroCollectionData
}

export interface ZoteroTag {
  tag: string
  links: ZoteroLinks
  meta: { type: number; numItems: number }
}

export interface ZoteroSearchCondition {
  condition: string
  operator: string
  value: string
}

export interface ZoteroSavedSearch {
  key: string
  version: number
  library: ZoteroLibraryInfo
  links: ZoteroLinks
  data: { key: string; version: number; name: string; conditions: ZoteroSearchCondition[] }
}

/** A page of results plus the metadata Zotero returns in headers. */
export interface ZoteroPage<T> {
  items: T[]
  /** From the `Total-Results` header; falls back to the page length. */
  totalResults: number
  /** From the `Last-Modified-Version` header. */
  version: number
  start: number
  limit: number
}

export type ZoteroQueryMode = 'titleCreatorYear' | 'everything'

export interface ZoteroItemQuery {
  /** Restrict to a collection key. */
  collectionKey?: string
  /** Only top-level items (hides child notes/attachments). */
  top?: boolean
  /** Free-text query. */
  q?: string
  qmode?: ZoteroQueryMode
  /** Tag filter. Zotero supports `A || B` (or) and `-A` (not). */
  tag?: string | string[]
  /** e.g. `-attachment || note` to exclude attachments and notes. */
  itemType?: string
  sort?: 'dateAdded' | 'dateModified' | 'title' | 'creator' | 'date' | 'itemType'
  direction?: 'asc' | 'desc'
  limit?: number
  start?: number
  /** Extra payloads: `bib`, `citation`, `data`. */
  include?: string
  /** CSL style id used with `include=bib|citation`. */
  style?: string
}

export interface ZoteroConnectionInfo {
  ok: boolean
  /** Which source answered: the live local API or the bundled demo library. */
  source: 'local' | 'demo'
  message?: string
  /** Total item count when known. */
  itemCount?: number
}
