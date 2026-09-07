import { formatReference } from './format'
import { parseCollections, parseItem, parseItems, parseTags } from './schemas'
import { chunk, ZoteroRequestError, ZoteroUnavailableError, type ZoteroSource } from './source'
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

/** Zotero caps `limit` at 100 for a single request. */
const MAX_LIMIT = 100
/** Zotero rejects overly long `itemKey` lists. */
const MAX_KEYS_PER_REQUEST = 50

export interface LocalApiOptions {
  /**
   * Path or origin the API lives behind. Defaults to the Vite proxy mount, which
   * forwards to http://127.0.0.1:23119 — the local API sends no CORS headers, so
   * the browser must not call it directly.
   */
  baseUrl?: string
  library?: ZoteroLibraryRef
  /** Only needed when pointed at api.zotero.org rather than the local server. */
  apiKey?: string
}

export const DEFAULT_BASE_URL = '/zotero-api/api'
export const DEFAULT_LIBRARY: ZoteroLibraryRef = { type: 'user', id: 0 }

type QueryParams = Record<string, string | number | boolean | string[] | undefined>

function toSearchParams(params: QueryParams): URLSearchParams {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry)
    } else {
      search.set(key, String(value))
    }
  }
  return search
}

export class LocalApiSource implements ZoteroSource {
  readonly id = 'local' as const
  readonly library: ZoteroLibraryRef
  private readonly baseUrl: string
  private readonly apiKey?: string

  constructor(options: LocalApiOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.library = options.library ?? DEFAULT_LIBRARY
    this.apiKey = options.apiKey
  }

  private get libraryPath(): string {
    return this.library.type === 'group' ? `/groups/${this.library.id}` : `/users/${this.library.id}`
  }

  private url(path: string, params: QueryParams = {}): string {
    const search = toSearchParams(params).toString()
    return `${this.baseUrl}${this.libraryPath}${path}${search ? `?${search}` : ''}`
  }

  private async request(url: string, signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { 'Zotero-API-Version': '3' }
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`

    let response: Response
    try {
      response = await fetch(url, { headers, signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ZoteroUnavailableError(
        'Zotero did not respond. Make sure Zotero is running and the local API is enabled.',
      )
    }
    if (response.status === 404) {
      throw new ZoteroRequestError(
        404,
        url,
        'Not found. If this happens for every request, the local API is probably disabled in Zotero.',
      )
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new ZoteroRequestError(response.status, url, detail.slice(0, 200) || undefined)
    }
    return response
  }

  private async requestJson<T>(
    url: string,
    signal?: AbortSignal,
  ): Promise<{ payload: T; response: Response }> {
    const response = await this.request(url, signal)
    const text = await response.text()
    try {
      return { payload: JSON.parse(text) as T, response }
    } catch {
      throw new ZoteroRequestError(
        response.status,
        url,
        'Zotero returned a non-JSON response. Check that /zotero-api is proxied to the Zotero HTTP server.',
      )
    }
  }

  async ping(signal?: AbortSignal): Promise<ZoteroConnectionInfo> {
    try {
      const { response } = await this.requestJson<unknown>(
        this.url('/items/top', { limit: 1, format: 'json' }),
        signal,
      )
      const total = Number(response.headers.get('Total-Results'))
      return {
        ok: true,
        source: 'local',
        itemCount: Number.isFinite(total) ? total : undefined,
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return { ok: false, source: 'local', message: (error as Error).message }
    }
  }

  async getCollections(signal?: AbortSignal): Promise<ZoteroCollection[]> {
    const all: ZoteroCollection[] = []
    let start = 0
    // Collections are usually few, but large libraries do exceed one page.
    for (;;) {
      const { payload, response } = await this.requestJson<unknown>(
        this.url('/collections', { limit: MAX_LIMIT, start, format: 'json' }),
        signal,
      )
      const page = parseCollections(payload)
      all.push(...page)
      const total = Number(response.headers.get('Total-Results'))
      start += MAX_LIMIT
      if (page.length < MAX_LIMIT || !Number.isFinite(total) || start >= total) break
    }
    return all
  }

  async getItems(query: ZoteroItemQuery, signal?: AbortSignal): Promise<ZoteroPage<ZoteroItem>> {
    const { collectionKey, top = true, limit = 50, start = 0, include = 'data', ...rest } = query
    const segment = collectionKey ? `/collections/${collectionKey}/items` : '/items'
    const path = top ? `${segment}/top` : segment
    const url = this.url(path, { ...rest, include, limit, start, format: 'json' })

    const { payload, response } = await this.requestJson<unknown>(url, signal)
    const items = parseItems(payload)
    const total = Number(response.headers.get('Total-Results'))
    const version = Number(response.headers.get('Last-Modified-Version'))
    return {
      items,
      totalResults: Number.isFinite(total) ? total : items.length,
      version: Number.isFinite(version) ? version : 0,
      start,
      limit,
    }
  }

  async getItem(key: string, signal?: AbortSignal): Promise<ZoteroItem> {
    const { payload } = await this.requestJson<unknown>(
      this.url(`/items/${key}`, { format: 'json' }),
      signal,
    )
    return parseItem(payload)
  }

  async getChildren(key: string, signal?: AbortSignal): Promise<ZoteroItem[]> {
    const { payload } = await this.requestJson<unknown>(
      this.url(`/items/${key}/children`, { format: 'json', limit: MAX_LIMIT }),
      signal,
    )
    return parseItems(payload)
  }

  async getItemsByKeys(keys: string[], signal?: AbortSignal): Promise<ZoteroItem[]> {
    if (keys.length === 0) return []
    const batches = await Promise.all(
      chunk(keys, MAX_KEYS_PER_REQUEST).map(async (batch) => {
        const { payload } = await this.requestJson<unknown>(
          this.url('/items', { itemKey: batch.join(','), format: 'json', limit: MAX_LIMIT }),
          signal,
        )
        return parseItems(payload)
      }),
    )
    const byKey = new Map(batches.flat().map((item) => [item.key, item]))
    return keys.map((key) => byKey.get(key)).filter((item): item is ZoteroItem => Boolean(item))
  }

  async getTags(signal?: AbortSignal): Promise<ZoteroTag[]> {
    const { payload } = await this.requestJson<unknown>(
      this.url('/tags', { limit: MAX_LIMIT, format: 'json' }),
      signal,
    )
    return parseTags(payload)
  }

  async getSavedSearches(signal?: AbortSignal): Promise<ZoteroSavedSearch[]> {
    const { payload } = await this.requestJson<unknown>(
      this.url('/searches', { limit: MAX_LIMIT, format: 'json' }),
      signal,
    )
    return Array.isArray(payload) ? (payload as ZoteroSavedSearch[]) : []
  }

  async getBibliography(keys: string[], style: string, signal?: AbortSignal): Promise<string[]> {
    if (keys.length === 0) return []
    try {
      const batches = await Promise.all(
        chunk(keys, MAX_KEYS_PER_REQUEST).map(async (batch) => {
          const { payload } = await this.requestJson<unknown>(
            this.url('/items', {
              itemKey: batch.join(','),
              include: 'data,bib',
              style,
              format: 'json',
              limit: MAX_LIMIT,
            }),
            signal,
          )
          return parseItems(payload)
        }),
      )
      const byKey = new Map(batches.flat().map((item) => [item.key, item]))
      return keys.map((key) => {
        const item = byKey.get(key)
        if (!item) return ''
        return item.bib ?? formatReference(item)
      })
    } catch {
      // citeproc can fail for unknown styles — fall back to a plain author-date line.
      const items = await this.getItemsByKeys(keys, signal)
      return items.map(formatReference)
    }
  }

  /** Zotero 7's local API serves attachment binaries at `/items/<key>/file`. */
  getItemFileUrl(key: string): string {
    return this.url(`/items/${key}/file`)
  }
}
