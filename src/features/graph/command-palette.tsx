import { BookOpen, Home, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useAddItemsToBoard } from '@/features/graph/use-add-items'
import { useItems } from '@/features/zotero/queries'
import { creatorSummary, itemTitle, itemYear } from '@/features/zotero/format'
import type { ZoteroItem } from '@/features/zotero/types'

function ItemOption({ item, onPick }: { item: ZoteroItem; onPick: (item: ZoteroItem) => void }) {
  const year = itemYear(item)
  const creators = creatorSummary(item)
  return (
    <CommandItem
      value={[itemTitle(item), creators, year, item.key].filter(Boolean).join(' ')}
      onSelect={() => onPick(item)}
      className="gap-2"
    >
      <BookOpen className="text-muted-foreground size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{itemTitle(item)}</p>
        <p className="text-muted-foreground truncate text-xs">
          {[creators, year].filter(Boolean).join(' · ')}
        </p>
      </div>
    </CommandItem>
  )
}

/** Server-side search palette (Ctrl/Cmd+K). cmdk filtering is bypassed with filter={() => 1}. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const addItems = useAddItemsToBoard()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const trimmed = search.trim()
  const searching = trimmed.length >= 2
  const { data, isFetching } = useItems(
    {
      q: trimmed || undefined,
      qmode: 'everything',
      limit: 14,
      top: true,
      sort: 'dateModified',
      direction: 'desc',
    },
    { enabled: open && searching },
  )

  const pick = (item: ZoteroItem) => {
    const added = addItems([item])
    if (added === 0) toast.info('Already on this board')
    else toast.success('Added to board')
    setOpen(false)
    setSearch('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
      title="Search Zotero"
      description="Find items in your library and add them to the board"
    >
      <Command shouldFilter={false} value={trimmed} className="gap-0">
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search your Zotero library…"
        />
        <CommandList>
          <CommandEmpty>
            {!searching ? (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3" /> Type at least 2 characters to search
              </span>
            ) : isFetching ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" /> Searching…
              </span>
            ) : (
              'No items found'
            )}
          </CommandEmpty>
          {searching && (data?.items.length ?? 0) > 0 && (
            <CommandGroup heading="Zotero items">
              {(data?.items ?? []).map((item) => (
                <ItemOption key={item.key} item={item} onPick={pick} />
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Actions">
            <CommandItem
              value="Go to board gallery"
              onSelect={() => {
                setOpen(false)
                navigate('/boards')
              }}
              className="gap-2"
            >
              <Home className="text-muted-foreground size-3.5" />
              Go to board gallery
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
