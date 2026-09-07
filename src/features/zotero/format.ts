import type { ZoteroCreator, ZoteroItem, ZoteroItemData, ZoteroLibraryRef } from './types'

export const ITEM_TYPE_LABELS: Record<string, string> = {
  artwork: 'Artwork',
  audioRecording: 'Audio Recording',
  bill: 'Bill',
  blogPost: 'Blog Post',
  book: 'Book',
  bookSection: 'Book Section',
  case: 'Case',
  computerProgram: 'Software',
  conferencePaper: 'Conference Paper',
  dataset: 'Dataset',
  dictionaryEntry: 'Dictionary Entry',
  document: 'Document',
  email: 'E-mail',
  encyclopediaArticle: 'Encyclopedia Article',
  film: 'Film',
  forumPost: 'Forum Post',
  hearing: 'Hearing',
  instantMessage: 'Instant Message',
  interview: 'Interview',
  journalArticle: 'Journal Article',
  letter: 'Letter',
  magazineArticle: 'Magazine Article',
  manuscript: 'Manuscript',
  map: 'Map',
  newspaperArticle: 'Newspaper Article',
  note: 'Note',
  patent: 'Patent',
  podcast: 'Podcast',
  preprint: 'Preprint',
  presentation: 'Presentation',
  radioBroadcast: 'Radio Broadcast',
  report: 'Report',
  standard: 'Standard',
  statute: 'Statute',
  thesis: 'Thesis',
  tvBroadcast: 'TV Broadcast',
  videoRecording: 'Video Recording',
  webpage: 'Web Page',
  attachment: 'Attachment',
  annotation: 'Annotation',
}

export function itemTypeLabel(itemType: string): string {
  return ITEM_TYPE_LABELS[itemType] ?? itemType.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

export function creatorName(creator: ZoteroCreator): string {
  if (creator.name) return creator.name
  return [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim()
}

/** "Lastname" style label used on graph nodes and author chips. */
export function creatorLastName(creator: ZoteroCreator): string {
  return creator.lastName ?? creator.name ?? creator.firstName ?? ''
}

/** Mirrors Zotero's own `meta.creatorSummary` when it is not supplied. */
export function creatorSummary(item: Pick<ZoteroItem, 'meta' | 'data'>): string {
  if (item.meta?.creatorSummary) return item.meta.creatorSummary
  const authors = (item.data.creators ?? []).filter(
    (c) => c.creatorType === 'author' || c.creatorType === 'editor' || c.creatorType === 'presenter',
  )
  const pool = authors.length > 0 ? authors : (item.data.creators ?? [])
  const names = pool.map(creatorLastName).filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]} et al.`
}

const YEAR_RE = /\b(1\d{3}|20\d{2}|21\d{2})\b/

export function itemYear(item: Pick<ZoteroItem, 'meta' | 'data'>): string {
  const parsed = item.meta?.parsedDate
  if (parsed) {
    const match = YEAR_RE.exec(parsed)
    if (match) return match[1]!
  }
  const date = typeof item.data.date === 'string' ? item.data.date : ''
  const match = YEAR_RE.exec(date)
  return match?.[1] ?? ''
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Notes have no title field — Zotero derives one from the first line. */
export function itemTitle(item: Pick<ZoteroItem, 'data'>): string {
  const data = item.data
  if (typeof data.title === 'string' && data.title.trim()) return data.title.trim()
  if (data.itemType === 'note' && typeof data.note === 'string') {
    const text = stripHtml(data.note)
    return text.slice(0, 120) || 'Untitled note'
  }
  if (typeof data.filename === 'string' && data.filename) return data.filename
  return 'Untitled'
}

/** Publication / container line shown under the title. */
export function itemSource(item: Pick<ZoteroItem, 'data'>): string {
  const d = item.data
  const container =
    (d.publicationTitle as string) ||
    (d.bookTitle as string) ||
    (d.proceedingsTitle as string) ||
    (d.publisher as string) ||
    (d.repository as string) ||
    ''
  return typeof container === 'string' ? container : ''
}

/**
 * `zotero://` deep link that focuses the item in the Zotero desktop app.
 * The local user library uses the literal segment `library`.
 */
export function zoteroSelectUrl(itemKey: string, library: ZoteroLibraryRef): string {
  const scope = library.type === 'group' ? `groups/${library.id}` : 'library'
  return `zotero://select/${scope}/items/${itemKey}`
}

export function zoteroOpenPdfUrl(attachmentKey: string, library: ZoteroLibraryRef): string {
  const scope = library.type === 'group' ? `groups/${library.id}` : 'library'
  return `zotero://open-pdf/${scope}/items/${attachmentKey}`
}

const RELATION_URI_RE = /\/items\/([A-Z0-9]{8})$/i

/** Extracts item keys from a `relations` object (`dc:relation`, `owl:sameAs`, …). */
export function parseRelatedKeys(
  relations: ZoteroItemData['relations'],
  predicate = 'dc:relation',
): string[] {
  if (!relations) return []
  const raw = relations[predicate]
  if (!raw) return []
  const uris = Array.isArray(raw) ? raw : [raw]
  const keys: string[] = []
  for (const uri of uris) {
    const match = RELATION_URI_RE.exec(uri)
    if (match) keys.push(match[1]!.toUpperCase())
  }
  return keys
}

/** Minimal author-date reference, used as the offline fallback for `include=bib`. */
export function formatReference(item: ZoteroItem): string {
  const authors = (item.data.creators ?? []).map(creatorName).filter(Boolean)
  const authorPart =
    authors.length === 0 ? '' : authors.length > 3 ? `${authors[0]} et al.` : authors.join(', ')
  const year = itemYear(item)
  const source = itemSource(item)
  const doi = typeof item.data.DOI === 'string' ? item.data.DOI : ''
  return [
    authorPart,
    year ? `(${year}).` : '',
    `${itemTitle(item)}.`,
    source ? `${source}.` : '',
    doi ? `https://doi.org/${doi}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Stable, human-readable citation key: `smith2020` style. */
export function citationKey(item: ZoteroItem): string {
  const first = (item.data.creators ?? [])[0]
  const last = first ? creatorLastName(first) : ''
  const slug = last.toLowerCase().replace(/[^a-z]/g, '') || item.data.itemType.toLowerCase()
  return `${slug}${itemYear(item) || item.key.slice(0, 4).toLowerCase()}`
}

export function isRegularItem(item: ZoteroItem): boolean {
  return item.data.itemType !== 'attachment' && item.data.itemType !== 'annotation'
}
