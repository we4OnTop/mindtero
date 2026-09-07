import { ChevronLeft, ChevronRight, Filter, Loader2, Search, Tag, X } from 'lucide-react'
import { useMemo, type KeyboardEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CollectionTree } from './collection-tree'
import { ItemRow } from './item-row'
import { PAGE_SIZE, toItemQuery, useLibraryState } from './library-state'
import { useItems, useTags } from '@/features/zotero/queries'
import { useBoards } from '@/features/graph/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'

function TagFilter() {
  const { data: tags } = useTags()
  const selected = useLibraryState((state) => state.tags)
  const toggleTag = useLibraryState((state) => state.toggleTag)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label="Filter by tag">
          <Filter />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search tags…" />
          <CommandList>
            <CommandEmpty>No matching tags</CommandEmpty>
            <CommandGroup>
              {(tags ?? []).map((tag) => (
                <CommandItem
                  key={tag.tag}
                  value={tag.tag}
                  onSelect={() => toggleTag(tag.tag)}
                  className="gap-2"
                >
                  <span
                    className={cn(
                      'grid size-3.5 place-items-center rounded-[4px] border',
                      selected.includes(tag.tag)
                        ? 'bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {selected.includes(tag.tag) ? '✓' : ''}
                  </span>
                  <span className="truncate">{tag.tag}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                    {tag.meta.numItems}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ActiveTags() {
  const tags = useLibraryState((state) => state.tags)
  const toggleTag = useLibraryState((state) => state.toggleTag)
  const clearTags = useLibraryState((state) => state.clearTags)
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1 px-2 pb-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="max-w-full cursor-pointer font-normal" onClick={() => toggleTag(tag)}>
          <Tag className="size-3" />
          <span className="truncate">{tag}</span>
          <X className="size-3" />
        </Badge>
      ))}
      <Button size="xs" variant="ghost" onClick={clearTags} className="h-5 text-xs">
        Clear
      </Button>
    </div>
  )
}

function ItemList() {
  const state = useLibraryState()
  const query = useMemo(() => toItemQuery(state), [state])
  const { data, isFetching, isError, error, refetch } = useItems(query)
  const boardKeys = useBoards(
    useShallow((s) => {
      const board = s.activeBoardId ? s.boards[s.activeBoardId] : null
      return board?.nodes
        .filter((node) => node.type === 'zoteroItem')
        .map((node) => (node.data as { itemKey: string }).itemKey) ?? []
    }),
  )
  const keySet = useMemo(() => new Set(boardKeys), [boardKeys])

  const total = data?.totalResults ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="text-muted-foreground flex items-center gap-2 px-3 pb-1 text-[11px]">
        <span className="truncate">
          {data ? `${total} item${total === 1 ? '' : 's'}` : 'Loading library…'}
        </span>
        {isFetching && <Loader2 className="ml-auto size-3 animate-spin" />}
        {isError && (
          <Button size="xs" variant="ghost" onClick={() => void refetch()} className="ml-auto h-4 px-1 text-xs">
            Retry
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="px-1">
          {isError && (
            <li className="text-muted-foreground p-3 text-xs">{(error as Error).message}</li>
          )}
          {(data?.items ?? []).map((item) => (
            <ItemRow key={item.key} item={item} onBoard={keySet.has(item.key)} />
          ))}
        </ul>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-2 py-1.5">
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={state.page === 0}
            onClick={() => state.setPage(state.page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {state.page + 1} / {totalPages}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={state.page + 1 >= totalPages}
            onClick={() => state.setPage(state.page + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}

export function LibraryPanel() {
  const query = useLibraryState((state) => state.query)
  const setQuery = useLibraryState((state) => state.setQuery)
  const sort = useLibraryState((state) => state.sort)
  const setSort = useLibraryState((state) => state.setSort)
  const toggleDirection = useLibraryState((state) => state.toggleDirection)
  const direction = useLibraryState((state) => state.direction)

  const sortLabels: Record<string, string> = {
    dateModified: 'edited',
    dateAdded: 'added',
    date: 'dated',
    title: 'title',
    creator: 'author',
  }
  const sortLabel = (sortLabels[sort] ?? sort) || 'edited'

  const cycleSort = () => {
    const order = ['dateModified', 'title', 'creator', 'dateAdded'] as const
    const index = order.indexOf(sort as (typeof order)[number])
    const next = order[(index + 1) % order.length]!
    if (next === sort) toggleDirection()
    else setSort(next)
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') setQuery('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-1.5 px-2 py-2">
        <div className="relative flex items-center">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 size-3.5" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search titles…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-muted-foreground text-xs font-medium">Library</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={cycleSort}
              className="text-muted-foreground hover:text-foreground text-xs"
              title="Sort by: click to cycle"
            >
              {direction === 'desc' ? '↓' : '↑'} {sortLabel}
            </button>
            <TagFilter />
          </div>
        </div>
      </div>

      <ActiveTags />

      <div className="max-h-[45%] shrink-0 overflow-hidden border-b">
        <ScrollArea className="h-full">
          <CollectionTree />
        </ScrollArea>
      </div>

      <ItemList />

    </div>
  )
}
