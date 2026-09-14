import type { ZoteroSource } from '@/features/zotero/source'
import { ZoteroRequestError } from '@/features/zotero/source'

/**
 * Renders one page of a Zotero PDF attachment into a JPEG/PNG data URL via
 * pdf.js (loaded lazily so the main bundle stays small). The request is a
 * plain GET — Mindtero never writes anything to Zotero.
 */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).href
      return pdfjs
    })
  }
  return pdfjsPromise
}

export interface PdfPageInfo {
  page: number
  dataUrl: string
  width: number
  height: number
}

export async function renderPdfPage(
  source: ZoteroSource,
  attachmentKey: string,
  pageNumber = 1,
): Promise<PdfPageInfo> {
  const fileUrl = source.getItemFileUrl?.(attachmentKey)
  if (!fileUrl) throw new Error('This library does not serve attachment files')

  const { task, doc } = await openDocument(fileUrl)
  try {
    return await renderPage(doc, pageNumber)
  } finally {
    // Destroying the loading task tears down the document and its worker port.
    void task.destroy()
  }
}

type PdfLoadingTask = ReturnType<Awaited<ReturnType<typeof loadPdfjs>>['getDocument']>
type PdfDocument = Awaited<PdfLoadingTask['promise']>

async function openDocument(fileUrl: string): Promise<{ task: PdfLoadingTask; doc: PdfDocument }> {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ url: fileUrl })
  try {
    return { task, doc: await task.promise }
  } catch (error) {
    void task.destroy()
    const status = (error as { status?: number }).status
    if (status === 404) throw new Error('Zotero has no file for this attachment (is it stored locally?)')
    if (status === 415) throw new Error('This attachment is not a PDF')
    if (status === 502) throw new Error('Zotero is not reachable — is it running?')
    throw error
  }
}

async function renderPage(doc: PdfDocument, pageNumber: number): Promise<PdfPageInfo> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.numPages) {
    throw new Error(`Page ${pageNumber} is out of range (1–${doc.numPages})`)
  }
  const page = await doc.getPage(pageNumber)
  // Enough resolution for readability, low enough to stay under ~1 MB per page.
  const scale = Math.min(2, Math.max(1, 1200 / page.getViewport({ scale: 1 }).width))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: context, viewport }).promise
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
  page.cleanup()
  return { page: pageNumber, dataUrl, width: canvas.width, height: canvas.height }
}

export async function countPdfPages(source: ZoteroSource, attachmentKey: string): Promise<number> {
  const fileUrl = source.getItemFileUrl?.(attachmentKey)
  if (!fileUrl) return 0
  const { task, doc } = await openDocument(fileUrl)
  try {
    return doc.numPages
  } finally {
    void task.destroy()
  }
}

/** True when the source can hand us attachment binaries at all. */
export function fileAccessAvailable(source: ZoteroSource): boolean {
  return typeof source.getItemFileUrl === 'function'
}

export { ZoteroRequestError }
