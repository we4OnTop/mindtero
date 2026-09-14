/**
 * Turns text dropped or pasted from Zotero into quote-card data.
 *
 * Zotero's reader copies and drags annotations as
 *
 *   „quote“ ([Cheng et al., 2026, p. 142](zotero://select/library/items/WMC6TAM4))
 *   ([pdf](zotero://open-pdf/library/items/8X8PA45H?page=2&annotation=IGVCE772))
 *
 * (Markdown note format) or as the equivalent HTML with <a> tags. Both carry
 * everything a card needs to jump back into the PDF. Link targets are never
 * stored verbatim: only validated keys are kept and URLs are rebuilt from them,
 * so a crafted drop cannot smuggle an arbitrary URL onto the board.
 */

export interface ParsedQuote {
  text: string
  citation?: string
  /** Printed page label taken from the citation ("142", "12–14"). */
  page?: string
  itemKey?: string
  libraryScope?: string
  attachmentKey?: string
  pdfPage?: number
  annotationKey?: string
}

const KEY = '[A-Z0-9]{8}'
const SCOPE = 'library|groups/\\d+'
const MARKDOWN_LINK = /\[([^\]]*)\]\((zotero:\/\/[^)\s]+)\)/g
const SELECT_URL = new RegExp(`^zotero://select/(${SCOPE})/items/(${KEY})$`)
const OPEN_PDF_URL = new RegExp(`^zotero://open-pdf/(${SCOPE})/items/(${KEY})(?:\\?(.*))?$`)
/** `([label](zotero://…))` citation groups, including the wrapping parentheses. */
const CITATION_GROUP = /\(\s*\[[^\]]*\]\(zotero:\/\/[^)\s]+\)\s*\)/g

const QUOTE_PAIRS: [string, string][] = [
  ['„', '“'],
  ['“', '”'],
  ['"', '"'],
  ['«', '»'],
  ['»', '«'],
  ['‚', '‘'],
  ['‘', '’'],
]

function stripOuterQuotes(text: string): string {
  const trimmed = text.trim()
  for (const [open, close] of QUOTE_PAIRS) {
    if (trimmed.length > 1 && trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return trimmed.slice(open.length, -close.length).trim()
    }
  }
  return trimmed
}

function pageFromCitation(citation: string): string | undefined {
  const match = /\bpp?\.\s*([\w–—-]+)\s*$/i.exec(citation)
  return match?.[1]
}

/** Parses one quote. Returns null when the text carries no Zotero citation at all. */
export function parseZoteroQuote(input: string): ParsedQuote | null {
  const source = input.replace(/\r\n?/g, '\n').trim()
  if (!source) return null

  const result: ParsedQuote = { text: '' }
  let sawZoteroLink = false

  for (const match of source.matchAll(MARKDOWN_LINK)) {
    const [, label = '', url = ''] = match
    const select = SELECT_URL.exec(url)
    if (select) {
      sawZoteroLink = true
      result.libraryScope ??= select[1]
      result.itemKey ??= select[2]
      const citation = label.trim()
      if (citation && !result.citation) result.citation = citation
      continue
    }
    const pdf = OPEN_PDF_URL.exec(url)
    if (pdf) {
      sawZoteroLink = true
      result.libraryScope ??= pdf[1]
      result.attachmentKey ??= pdf[2]
      const params = new URLSearchParams(pdf[3] ?? '')
      const page = Number.parseInt(params.get('page') ?? '', 10)
      if (Number.isInteger(page) && page > 0) result.pdfPage ??= page
      const annotation = params.get('annotation') ?? ''
      if (new RegExp(`^${KEY}$`).test(annotation)) result.annotationKey ??= annotation
    }
  }

  let body = source.replace(CITATION_GROUP, ' ').trim()

  // Without Zotero links, accept a plain trailing "(Author, 2020, p. 3)" citation.
  if (!sawZoteroLink) {
    const plain = /^([\s\S]*?[“”"»«’])\s*\(([^()]*\b\d{4}[a-z]?\b[^()]*)\)\s*$/.exec(body)
    if (!plain) return null
    body = plain[1] ?? ''
    result.citation = plain[2]?.trim()
  }

  result.text = stripOuterQuotes(body.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' '))
  if (!result.text) return null
  if (result.citation) result.page = pageFromCitation(result.citation)
  return result
}

/** A drop may hold several annotations separated by blank lines. */
export function parseZoteroQuotes(input: string): ParsedQuote[] {
  const whole = parseZoteroQuote(input)
  const chunks = input.split(/\n\s*\n/).filter((chunk) => chunk.trim())
  if (chunks.length <= 1) return whole ? [whole] : []
  const parsed = chunks.map(parseZoteroQuote)
  if (parsed.every((entry): entry is ParsedQuote => entry !== null)) return parsed
  return whole ? [whole] : []
}

/**
 * Flattens HTML (as Zotero puts on the clipboard) into text with Markdown links,
 * so the HTML and plain-text flavours share one parser.
 */
export function htmlToLinkedText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.textContent ?? '')
      return
    }
    if (!(node instanceof Element)) return
    const tag = node.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style') return
    if (tag === 'br') {
      out.push('\n')
      return
    }
    if (tag === 'a') {
      const href = node.getAttribute('href') ?? ''
      out.push(href.startsWith('zotero://') ? `[${node.textContent ?? ''}](${href})` : (node.textContent ?? ''))
      return
    }
    const block = /^(p|div|li|blockquote|h[1-6])$/.test(tag)
    node.childNodes.forEach(walk)
    if (block) out.push('\n\n')
  }
  doc.body.childNodes.forEach(walk)
  return out.join('').replace(/\n{3,}/g, '\n\n').trim()
}

/** Validated zotero://open-pdf URL for a quote, or null when it has no PDF link. */
export function quoteOpenPdfUrl(quote: {
  attachmentKey?: string
  libraryScope?: string
  pdfPage?: number
  annotationKey?: string
}): string | null {
  if (!quote.attachmentKey || !new RegExp(`^${KEY}$`).test(quote.attachmentKey)) return null
  const scope = quote.libraryScope && new RegExp(`^(${SCOPE})$`).test(quote.libraryScope)
    ? quote.libraryScope
    : 'library'
  const params = new URLSearchParams()
  if (quote.pdfPage && Number.isInteger(quote.pdfPage) && quote.pdfPage > 0) {
    params.set('page', String(quote.pdfPage))
  }
  if (quote.annotationKey && new RegExp(`^${KEY}$`).test(quote.annotationKey)) {
    params.set('annotation', quote.annotationKey)
  }
  const search = params.toString()
  return `zotero://open-pdf/${scope}/items/${quote.attachmentKey}${search ? `?${search}` : ''}`
}
