// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { estimateQuoteHeight } from './canvas-drop'
import { htmlToLinkedText, parseZoteroQuote, parseZoteroQuotes, quoteOpenPdfUrl } from './quote-parse'

const FIRST =
  '„With the increasing complexity and interconnectivity of software systems, accurate requirement identification and management are becoming increasingly critical and problematic. The primary contributors to cost overruns in software projects are frequent requirement changes and the lack of understanding of system needs among stakeholders ([1]).“ ([Cheng et al., 2026, p. 142](zotero://select/library/items/WMC6TAM4)) ([pdf](zotero://open-pdf/library/items/8X8PA45H?page=2))'

const SECOND =
  '„The analysis highlights several noteworthy trends in the use of GenAI in RE. First, this field has undergone rapid expansion.“ ([Cheng et al., 2026, p. 153](zotero://select/library/items/WMC6TAM4)) ([pdf](zotero://open-pdf/library/items/8X8PA45H?page=13&annotation=IGVCE772))'

describe('parseZoteroQuote', () => {
  it('reads the Zotero markdown quote format', () => {
    const quote = parseZoteroQuote(FIRST)!
    expect(quote.text.startsWith('With the increasing complexity')).toBe(true)
    // Inner bracketed references are part of the quote, not a citation.
    expect(quote.text.endsWith('among stakeholders ([1]).')).toBe(true)
    expect(quote).toMatchObject({
      citation: 'Cheng et al., 2026, p. 142',
      page: '142',
      itemKey: 'WMC6TAM4',
      libraryScope: 'library',
      attachmentKey: '8X8PA45H',
      pdfPage: 2,
    })
    expect(quote.annotationKey).toBeUndefined()
  })

  it('picks up the annotation key', () => {
    const quote = parseZoteroQuote(SECOND)!
    expect(quote).toMatchObject({ pdfPage: 13, annotationKey: 'IGVCE772', page: '153' })
  })

  it('accepts a plain trailing citation without links', () => {
    expect(parseZoteroQuote('"Short claim." (Doe, 2019, p. 7)')).toMatchObject({
      text: 'Short claim.',
      citation: 'Doe, 2019, p. 7',
      page: '7',
    })
  })

  it('returns null for ordinary text', () => {
    expect(parseZoteroQuote('just a thought (maybe)')).toBeNull()
    expect(parseZoteroQuote('')).toBeNull()
  })

  it('ignores zotero links with malformed keys', () => {
    const quote = parseZoteroQuote('„x“ ([A, 2020](zotero://select/library/items/bad)) ')
    expect(quote?.itemKey).toBeUndefined()
  })
})

describe('parseZoteroQuotes', () => {
  it('splits several dropped annotations', () => {
    expect(parseZoteroQuotes(`${FIRST}\n\n${SECOND}`)).toHaveLength(2)
  })
})

describe('htmlToLinkedText', () => {
  it('turns Zotero HTML into the markdown flavour', () => {
    const html =
      '<p>„Quoted.“ (<a href="zotero://select/library/items/WMC6TAM4">Cheng et al., 2026, p. 142</a>) (<a href="zotero://open-pdf/library/items/8X8PA45H?page=2">pdf</a>)</p>'
    const quote = parseZoteroQuote(htmlToLinkedText(html))
    expect(quote).toMatchObject({ text: 'Quoted.', itemKey: 'WMC6TAM4', pdfPage: 2 })
  })

  it('drops non-zotero link targets', () => {
    expect(htmlToLinkedText('<a href="javascript:alert(1)">x</a>')).toBe('x')
  })
})

describe('quoteOpenPdfUrl', () => {
  it('rebuilds a validated URL', () => {
    expect(quoteOpenPdfUrl({ attachmentKey: '8X8PA45H', pdfPage: 13, annotationKey: 'IGVCE772' })).toBe(
      'zotero://open-pdf/library/items/8X8PA45H?page=13&annotation=IGVCE772',
    )
  })

  it('refuses unvalidated input', () => {
    expect(quoteOpenPdfUrl({ attachmentKey: '../../x' })).toBeNull()
    expect(quoteOpenPdfUrl({ attachmentKey: '8X8PA45H', libraryScope: 'evil' })).toBe(
      'zotero://open-pdf/library/items/8X8PA45H',
    )
  })
})

describe('estimateQuoteHeight', () => {
  it('grows with the text so stacked quotes do not overlap', () => {
    expect(estimateQuoteHeight('x'.repeat(600), 320)).toBeGreaterThan(estimateQuoteHeight('x'.repeat(200), 320) + 80)
    expect(estimateQuoteHeight('short', 320)).toBeGreaterThanOrEqual(70)
  })
})
