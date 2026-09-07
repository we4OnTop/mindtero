import { Check, ExternalLink, Plus } from 'lucide-react'
import type { DragEvent } from 'react'
import { toast } from 'sonner'
import { ItemTypeIcon } from '@/components/common/item-type-icon'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { setDragItems } from '@/features/graph/dnd'
import { useAddItemsToBoard } from '@/features/graph/use-add-items'
import { creatorSummary, itemTitle, itemYear, zoteroSelectUrl } from '@/features/zotero/format'
import { useZoteroSource } from '@/features/zotero/provider'
import type { ZoteroItem } from '@/features/zotero/types'
import { cn } from '@/lib/utils'

export function ItemRow({ item, onBoard }: { item: ZoteroItem; onBoard: boolean }) {
  const addItems = useAddItemsToBoard()
  const source = useZoteroSource()
  const year = itemYear(item)
  const creators = creatorSummary(item)

  const onDragStart = (event: DragEvent) => {
    setDragItems(event, [item])
  }

  const add = () => {
    const added = addItems([item])
    if (added === 0) toast.info('Already on this board')
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <li
          draggable
          onDragStart={onDragStart}
          onDoubleClick={add}
          className={cn(
            'group hover:bg-muted/60 flex cursor-grab items-start gap-2 rounded-md px-2 py-1.5 active:cursor-grabbing',
            onBoard && 'opacity-60',
          )}
        >
          <ItemTypeIcon
            itemType={item.data.itemType}
            className="text-muted-foreground mt-0.5 size-3.5"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-snug">{itemTitle(item)}</p>
            <p className="text-muted-foreground truncate text-xs">
              {[creators, year].filter(Boolean).join(' · ')}
            </p>
          </div>
          {onBoard ? (
            <Check className="text-muted-foreground mt-1 size-3.5 shrink-0" aria-label="On board" />
          ) : (
            <Button
              size="icon-xs"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={add}
              aria-label="Add to board"
            >
              <Plus />
            </Button>
          )}
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={add} disabled={onBoard}>
          <Plus /> Add to board
        </ContextMenuItem>
        <ContextMenuItem asChild>
          <a href={zoteroSelectUrl(item.key, source.library)}>
            <ExternalLink /> Open in Zotero
          </a>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
