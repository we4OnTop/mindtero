import type {
  ZoteroCollection,
  ZoteroConnectionInfo,
  ZoteroItem,
  ZoteroItemQuery,
  ZoteroLibraryRef,
  ZoteroPage,
  ZoteroSavedSearch,
  ZoteroTag,
} from './types'

/** Zotero answered, but not with success. */
export class ZoteroRequestError extends Error {
  readonly status: number
  readonly url: string

  constructor(status: number, url: string, message?: string) {
    super(message ?? `Zotero API request failed (${status})`)
    this.name = 'ZoteroRequestError'
    this.status = status
    this.url = url
  }
}

/** Zotero is closed, the local API is disabled, or the proxy is not running. */
export class ZoteroUnavailableError extends Error {
  constructor(message = 'Cannot reach the Zotero local API') {
    super(message)
    this.name = 'ZoteroUnavailableError'
  }
}

/**
 * The single seam between the app and Zotero. `local-api.ts` talks HTTP to the
 * Zotero 7 local server; `demo.ts` serves bundled fixtures. A future adapter can
 * talk to api.zotero.org with an API key to gain write access.
 */
export interface ZoteroSource {
  readonly id: 'local' | 'demo'
  readonly library: ZoteroLibraryRef
  ping(signal?: AbortSignal): Promise<ZoteroConnectionInfo>
  getCollections(signal?: AbortSignal): Promise<ZoteroCollection[]>
  getItems(query: ZoteroItemQuery, signal?: AbortSignal): Promise<ZoteroPage<ZoteroItem>>
  getItem(key: string, signal?: AbortSignal): Promise<ZoteroItem>
  /** Child notes and attachments of an item. */
  getChildren(key: string, signal?: AbortSignal): Promise<ZoteroItem[]>
  getItemsByKeys(keys: string[], signal?: AbortSignal): Promise<ZoteroItem[]>
  getTags(signal?: AbortSignal): Promise<ZoteroTag[]>
  getSavedSearches(signal?: AbortSignal): Promise<ZoteroSavedSearch[]>
  /** HTML bibliography entries, in the order of `keys`. */
  getBibliography(keys: string[], style: string, signal?: AbortSignal): Promise<string[]>
  /**
   * URL that serves the raw file of an attachment item (PNG/PDF/…). Returns
   * null when the source cannot serve files (e.g. the demo fixtures). Read-only
   * GET — Mindtero never writes anything to Zotero.
   */
  getItemFileUrl?(key: string): string | null
}

export function chunk<T>(input: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < input.length; i += size) out.push(input.slice(i, i + size))
  return out
}
