import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useSettings } from '@/lib/settings'
import { useZoteroSource } from './provider'
import type {
  ZoteroCollection,
  ZoteroConnectionInfo,
  ZoteroItem,
  ZoteroItemQuery,
  ZoteroPage,
  ZoteroTag,
} from './types'

/** Query keys are namespaced by source id so switching to demo mode swaps caches. */
export const zoteroKeys = {
  root: (sourceId: string) => ['zotero', sourceId] as const,
  connection: (sourceId: string) => [...zoteroKeys.root(sourceId), 'connection'] as const,
  collections: (sourceId: string) => [...zoteroKeys.root(sourceId), 'collections'] as const,
  tags: (sourceId: string) => [...zoteroKeys.root(sourceId), 'tags'] as const,
  items: (sourceId: string, query: ZoteroItemQuery) =>
    [...zoteroKeys.root(sourceId), 'items', query] as const,
  item: (sourceId: string, key: string) => [...zoteroKeys.root(sourceId), 'item', key] as const,
  children: (sourceId: string, key: string) =>
    [...zoteroKeys.root(sourceId), 'children', key] as const,
  byKeys: (sourceId: string, keys: string[]) =>
    [...zoteroKeys.root(sourceId), 'byKeys', [...keys].sort()] as const,
  bibliography: (sourceId: string, keys: string[], style: string) =>
    [...zoteroKeys.root(sourceId), 'bib', style, [...keys].sort()] as const,
}

export function useZoteroConnection(): UseQueryResult<ZoteroConnectionInfo> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: zoteroKeys.connection(source.id),
    queryFn: ({ signal }) => source.ping(signal),
    retry: false,
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data?.ok ? 60_000 : 15_000),
    refetchOnWindowFocus: true,
  })
}

export function useCollections(): UseQueryResult<ZoteroCollection[]> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: zoteroKeys.collections(source.id),
    queryFn: ({ signal }) => source.getCollections(signal),
    staleTime: 60_000,
  })
}

export function useTags(): UseQueryResult<ZoteroTag[]> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: zoteroKeys.tags(source.id),
    queryFn: ({ signal }) => source.getTags(signal),
    staleTime: 60_000,
  })
}

export function useItems(
  query: ZoteroItemQuery,
  options: { enabled?: boolean } = {},
): UseQueryResult<ZoteroPage<ZoteroItem>> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: zoteroKeys.items(source.id, query),
    queryFn: ({ signal }) => source.getItems(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  })
}

export function useItem(key: string | null | undefined): UseQueryResult<ZoteroItem> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: zoteroKeys.item(source.id, key ?? ''),
    queryFn: ({ signal }) => source.getItem(key!, signal),
    enabled: Boolean(key),
    staleTime: 60_000,
  })
}

export function useItemChildren(key: string | null | undefined): UseQueryResult<ZoteroItem[]> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: zoteroKeys.children(source.id, key ?? ''),
    queryFn: ({ signal }) => source.getChildren(key!, signal),
    enabled: Boolean(key),
    staleTime: 60_000,
  })
}

/**
 * Text annotations (highlights) of an item's PDFs. Zotero's local API does
 * *not* expose annotations under `/items/<attachment>/children`, so we query
 * all annotation-type items and match them against the item's PDF keys.
 */
export function useItemAnnotations(
  key: string | null | undefined,
): UseQueryResult<ZoteroItem[]> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: [...zoteroKeys.children(source.id, key ?? ''), 'annotations'] as const,
    queryFn: async ({ signal }) => {
      const children = await source.getChildren(key!, signal)
      const pdfKeys = new Set(
        children
          .filter(
            (child) =>
              child.data.itemType === 'attachment' &&
              child.data.contentType === 'application/pdf',
          )
          .map((entry) => entry.key),
      )
      if (pdfKeys.size === 0) return []
      const annotations = await source.getItems({
        itemType: 'annotation',
        top: false,
        limit: 100,
      }, signal)
      return annotations.items
        .filter((entry) =>
          pdfKeys.has(typeof entry.data.parentItem === 'string' ? entry.data.parentItem : ''),
        )
        .filter(
          (entry) =>
            typeof entry.data.annotationText === 'string' && entry.data.annotationText,
        )
    },
    enabled: Boolean(key),
    staleTime: 60_000,
  })
}

export function useItemsByKeys(keys: string[]): UseQueryResult<ZoteroItem[]> {
  const source = useZoteroSource()
  return useQuery({
    queryKey: zoteroKeys.byKeys(source.id, keys),
    queryFn: ({ signal }) => source.getItemsByKeys(keys, signal),
    enabled: keys.length > 0,
    staleTime: 60_000,
  })
}

export function useBibliography(keys: string[]): UseQueryResult<string[]> {
  const source = useZoteroSource()
  const style = useSettings((s) => s.citationStyle)
  return useQuery({
    queryKey: zoteroKeys.bibliography(source.id, keys, style),
    queryFn: ({ signal }) => source.getBibliography(keys, style, signal),
    enabled: keys.length > 0,
    staleTime: 5 * 60_000,
  })
}
