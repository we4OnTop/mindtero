import { create } from 'zustand'
import type { ZoteroItemQuery } from '@/features/zotero/types'

export const PAGE_SIZE = 40

interface LibraryState {
  collectionKey: string | null
  query: string
  tags: string[]
  itemType: string | null
  sort: NonNullable<ZoteroItemQuery['sort']>
  direction: NonNullable<ZoteroItemQuery['direction']>
  page: number
  setCollection: (key: string | null) => void
  setQuery: (query: string) => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  setItemType: (itemType: string | null) => void
  setSort: (sort: NonNullable<ZoteroItemQuery['sort']>) => void
  toggleDirection: () => void
  setPage: (page: number) => void
}

export const useLibraryState = create<LibraryState>((set) => ({
  collectionKey: null,
  query: '',
  tags: [],
  itemType: null,
  sort: 'dateModified',
  direction: 'desc',
  page: 0,
  // Any filter change resets pagination — otherwise page 3 of the old result set
  // silently becomes an empty page of the new one.
  setCollection: (collectionKey) => set({ collectionKey, page: 0 }),
  setQuery: (query) => set({ query, page: 0 }),
  toggleTag: (tag) =>
    set((state) => ({
      tags: state.tags.includes(tag) ? state.tags.filter((entry) => entry !== tag) : [...state.tags, tag],
      page: 0,
    })),
  clearTags: () => set({ tags: [], page: 0 }),
  setItemType: (itemType) => set({ itemType, page: 0 }),
  setSort: (sort) => set({ sort, page: 0 }),
  toggleDirection: () =>
    set((state) => ({ direction: state.direction === 'asc' ? 'desc' : 'asc', page: 0 })),
  setPage: (page) => set({ page }),
}))

/** Builds the API query from the current filter state. */
export function toItemQuery(state: LibraryState): ZoteroItemQuery {
  return {
    collectionKey: state.collectionKey ?? undefined,
    top: true,
    q: state.query.trim() || undefined,
    qmode: 'titleCreatorYear',
    // Zotero's tag syntax: repeated params are AND, `||` inside one param is OR.
    tag: state.tags.length > 0 ? state.tags : undefined,
    itemType: state.itemType ?? undefined,
    sort: state.sort,
    direction: state.direction,
    limit: PAGE_SIZE,
    start: state.page * PAGE_SIZE,
  }
}
