import {
  BookOpen,
  FileText,
  Frame,
  GanttChart,
  Hash,
  HelpCircle,
  Image,
  Quote,
  Scale,
  StickyNote,
  Tag,
  Type,
  User,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { searchBoard, searchEntries, tagCounts } from './board-search'
import { useCanvasUi } from './canvas-ui'
import { useActiveBoard } from './store'
import { useFocusNode } from './use-focus-node'

const TYPE_ICONS: Record<string, ReactNode> = {
  zoteroItem: <BookOpen />,
  note: <StickyNote />,
  quote: <Quote />,
  claim: <Scale />,
  question: <HelpCircle />,
  richText: <Type />,
  frame: <Frame />,
  timeline: <GanttChart />,
  image: <Image />,
  tag: <Tag />,
  creator: <User />,
}

/** Ctrl+F: find any card on this board by its text, citation or tags. */
export function BoardSearch() {
  const open = useCanvasUi((state) => state.searchOpen)
  const setOpen = useCanvasUi((state) => state.setSearchOpen)
  const board = useActiveBoard()
  const focusNode = useFocusNode()
  const [query, setQuery] = useState('')

  // Only index while the dialog is open; the board changes constantly otherwise.
  const entries = useMemo(() => (open && board ? searchEntries(board.nodes) : []), [open, board])
  const tags = useMemo(() => (open && board ? tagCounts(board.nodes).slice(0, 24) : []), [open, board])
  const hits = useMemo(() => searchBoard(entries, query), [entries, query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title="Search this board"
      description="Find cards by text, citation or tag"
    >
      <Command shouldFilter={false} className="gap-0">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder='Search text, citations… use #tag or #"two words"'
        />
        <CommandList className="max-h-[60vh]">
          {query.trim() === '' ? (
            <div className="space-y-2 p-3">
              <p className="text-muted-foreground text-xs">
                Every word must match. <code>#tag</code> filters by tag — including tags cards inherit from a
                tag group.
              </p>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setQuery(tag.includes(' ') ? `#"${tag}" ` : `#${tag} `)}
                      className="hover:bg-accent inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs"
                    >
                      <Hash className="size-3" />
                      {tag}
                      <span className="text-muted-foreground ml-1 tabular-nums">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <CommandEmpty>No cards match.</CommandEmpty>
              {hits.length > 0 && (
                <CommandGroup heading={`${hits.length} card${hits.length === 1 ? '' : 's'}`}>
                  {hits.map(({ entry, snippet }) => {
                    const isQuote = entry.type === 'note' && entry.title !== 'Note'
                    return (
                      <CommandItem
                        key={entry.nodeId}
                        value={entry.nodeId}
                        onSelect={() => {
                          close()
                          // Let the dialog close before the canvas takes focus.
                          window.setTimeout(() => focusNode(entry.nodeId), 0)
                        }}
                        className="items-start gap-2 [&_svg]:mt-0.5"
                      >
                        <span className="text-muted-foreground">
                          {TYPE_ICONS[isQuote ? 'quote' : entry.type] ?? <FileText />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{entry.title}</p>
                          {snippet && snippet !== entry.title && (
                            <p className="text-muted-foreground line-clamp-2 text-xs">{snippet}</p>
                          )}
                          {entry.tags.length > 0 && (
                            <p className="mt-0.5 flex flex-wrap gap-1">
                              {entry.tags.slice(0, 5).map((tag) => (
                                <span key={tag} className="text-muted-foreground text-[10px]">
                                  #{tag}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
